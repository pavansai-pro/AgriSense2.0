from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.db.mongo import get_mongo
from app.deps import get_current_user
from app.models.sql import User
from app.schemas import VoiceLogIn

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/logs", status_code=201)
def log_voice(
    items: list[VoiceLogIn], user: User = Depends(get_current_user), mongo: Database = Depends(get_mongo)
) -> dict:
    now = datetime.now(timezone.utc)
    if items:
        mongo.voice_logs.insert_many([{**i.model_dump(), "user_id": user.id, "created_at": now} for i in items[:100]])
    return {"stored": min(len(items), 100)}
