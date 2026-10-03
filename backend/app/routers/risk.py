from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from sqlalchemy.orm import Session

from agrisense_ml.predictor import SoilReading
from agrisense_ml.risk import assess_risk
from app.db.mongo import get_mongo
from app.db.postgres import get_db
from app.deps import get_current_user
from app.models.sql import User
from app.schemas import RiskIn
from app.services.rag import prevention_steps
from app.services.weather import LocationError, get_forecast, to_forecast_days

router = APIRouter(prefix="/api/risk", tags=["risk"])

INSURANCE = {
    "low": "Basic cover under PMFBY is usually enough.",
    "moderate": "Consider PMFBY yield cover plus a weather-index (RWBCIS) add-on.",
    "high": "Insure before sowing (PMFBY) and talk to your agriculture officer about weather-index cover.",
}


@router.post("/assess")
def assess(
    body: RiskIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo: Database = Depends(get_mongo),
) -> dict:
    soil = SoilReading(body.n, body.p, body.k, body.temperature, body.moisture, body.ph)
    weather = None
    try:
        weather = get_forecast(db, body.state or user.state, body.district or user.district, body.lat, body.lon)
    except LocationError:
        pass
    try:
        result = assess_risk(
            soil,
            body.crop,
            to_forecast_days(weather) if weather else [],
            body.sowing_date,
            body.planned_harvest,
        )
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    result["prevention"] = prevention_steps(result["query_tags"], body.crop)
    result["insurance"] = INSURANCE[result["level"]]
    result["weather"] = {
        "provider": weather["provider"] if weather else None,
        "location": weather["location"] if weather else None,
    }
    doc = {
        "user_id": user.id,
        "input": body.model_dump(mode="json"),
        "result": result,
        "created_at": datetime.now(timezone.utc),
    }
    result["id"] = str(mongo.risk_assessments.insert_one(doc).inserted_id)
    return result


@router.get("/history")
def history(limit: int = 10, user: User = Depends(get_current_user), mongo: Database = Depends(get_mongo)) -> list:
    cur = mongo.risk_assessments.find({"user_id": user.id}).sort("created_at", -1).limit(min(limit, 50))
    return [
        {
            "id": str(d["_id"]),
            "created_at": d["created_at"].isoformat(),
            "crop": d["result"]["crop"],
            "score": d["result"]["score"],
            "level": d["result"]["level"],
            "main_causes": d["result"]["main_causes"],
        }
        for d in cur
    ]
