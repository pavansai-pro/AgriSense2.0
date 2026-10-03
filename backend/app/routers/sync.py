"""Offline sync: the PWA queues soil readings and harvest records in IndexedDB and
pushes them here on reconnect. Last-write-wins on the client's updated_at; pushes
are idempotent per (user, client_id).

- soil_reading   -> MongoDB `sensor_readings` (flexible sensor payloads)
- harvest_record -> PostgreSQL `harvest_records` (structured)
"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ValidationError
from pymongo.database import Database
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.mongo import get_mongo
from app.db.postgres import get_db
from app.deps import get_current_user
from app.models.sql import HarvestRecord, User
from app.schemas import SoilIn, SyncPushIn, SyncRecord

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SoilPayload(SoilIn):
    crop: str | None = None
    notes: str | None = Field(default=None, max_length=1000)
    recorded_at: datetime | None = None
    lat: float | None = None
    lon: float | None = None


class HarvestPayload(BaseModel):
    crop: str = Field(min_length=1, max_length=60)
    variety: str | None = None
    area_acres: float | None = Field(default=None, ge=0)
    sowing_date: date | None = None
    expected_harvest: date | None = None
    actual_harvest: date | None = None
    yield_quintals: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=1000)


def _aware(dt: datetime) -> datetime:
    """UTC-aware and truncated to milliseconds, the precision MongoDB stores."""
    dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return dt.replace(microsecond=dt.microsecond // 1000 * 1000)


def _push_soil(rec: SyncRecord, user: User, mongo: Database, now: datetime) -> str:
    payload = SoilPayload.model_validate(rec.payload).model_dump(mode="json")
    existing = mongo.sensor_readings.find_one({"user_id": user.id, "client_id": rec.client_id})
    if existing and _aware(existing["client_updated_at"]) >= _aware(rec.updated_at):
        return "skipped_stale"
    mongo.sensor_readings.update_one(
        {"user_id": user.id, "client_id": rec.client_id},
        {
            "$set": {
                "payload": payload,
                "deleted": rec.deleted,
                "client_updated_at": _aware(rec.updated_at),
                "server_updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return "updated" if existing else "created"


def _push_harvest(rec: SyncRecord, user: User, db: Session, now: datetime) -> str:
    payload = HarvestPayload.model_validate(rec.payload)
    row = db.scalar(
        select(HarvestRecord).where(HarvestRecord.user_id == user.id, HarvestRecord.client_id == rec.client_id)
    )
    if row and _aware(row.client_updated_at) >= _aware(rec.updated_at):
        return "skipped_stale"
    status = "updated" if row else "created"
    if not row:
        row = HarvestRecord(user_id=user.id, client_id=rec.client_id)
        db.add(row)
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    row.deleted = rec.deleted
    row.client_updated_at = _aware(rec.updated_at)
    row.server_updated_at = now
    return status


@router.post("/push")
def push(
    body: SyncPushIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo: Database = Depends(get_mongo),
) -> dict:
    now = datetime.now(timezone.utc)
    results = []
    for rec in body.records:
        try:
            if rec.kind == "soil_reading":
                status = _push_soil(rec, user, mongo, now)
            else:
                status = _push_harvest(rec, user, db, now)
            results.append({"client_id": rec.client_id, "kind": rec.kind, "status": status})
        except ValidationError as e:
            results.append(
                {
                    "client_id": rec.client_id,
                    "kind": rec.kind,
                    "status": "error",
                    "error": e.errors(include_url=False, include_context=False),
                }
            )
    db.commit()
    return {"results": results, "server_time": now.isoformat()}


@router.get("/pull")
def pull(
    since: datetime | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo: Database = Depends(get_mongo),
) -> dict:
    since = _aware(since) if since else datetime(1970, 1, 1, tzinfo=timezone.utc)
    soil = [
        {
            "client_id": d["client_id"],
            "kind": "soil_reading",
            "payload": d["payload"],
            "deleted": d.get("deleted", False),
            "updated_at": _aware(d["client_updated_at"]).isoformat(),
        }
        for d in mongo.sensor_readings.find({"user_id": user.id, "server_updated_at": {"$gt": since}})
    ]
    rows = db.scalars(
        select(HarvestRecord).where(HarvestRecord.user_id == user.id, HarvestRecord.server_updated_at > since)
    ).all()
    harvest = [
        {
            "client_id": r.client_id,
            "kind": "harvest_record",
            "deleted": r.deleted,
            "updated_at": _aware(r.client_updated_at).isoformat(),
            "payload": HarvestPayload.model_validate(r, from_attributes=True).model_dump(mode="json"),
        }
        for r in rows
    ]
    return {"records": soil + harvest, "server_time": datetime.now(timezone.utc).isoformat()}
