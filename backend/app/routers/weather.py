from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.services.weather import LocationError, get_forecast

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/forecast")
def forecast(
    state: str | None = None,
    district: str | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    days: int = Query(default=16, ge=1, le=16),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return get_forecast(db, state, district, lat, lon, days)
    except LocationError as e:
        raise HTTPException(422, str(e)) from None
