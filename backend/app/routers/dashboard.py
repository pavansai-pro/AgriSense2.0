from fastapi import APIRouter, Depends
from pymongo.database import Database
from sqlalchemy.orm import Session

from agrisense_ml.knowledge import normalize_state
from app.db.mongo import get_mongo
from app.db.postgres import get_db
from app.deps import get_current_user
from app.models.sql import User
from app.services.ml import load_artifact
from app.services.weather import LocationError, get_forecast

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(
    user: User = Depends(get_current_user), db: Session = Depends(get_db), mongo: Database = Depends(get_mongo)
) -> dict:
    state = normalize_state(user.state)
    predictions = [
        {
            "id": str(d["_id"]),
            "created_at": d["created_at"].isoformat(),
            "recommended": d["result"]["recommended"],
            "top": [{"crop": c["crop"], "score": c["score"]} for c in d["result"]["crops"][:3]],
        }
        for d in mongo.predictions.find({"user_id": user.id}).sort("created_at", -1).limit(5)
    ]
    latest_risk = mongo.risk_assessments.find_one({"user_id": user.id}, sort=[("created_at", -1)])
    weather = None
    try:
        w = get_forecast(db, user.state, user.district)
        weather = {
            "location": w["location"],
            "provider": w["provider"],
            "days": w["days"][:5],
            "baseline": w.get("baseline"),
        }
    except LocationError:
        pass
    regional = load_artifact("regional_prior.json")
    crops = regional["states"].get(state or "", {})
    top_regional = sorted(
        ({"crop": c, **v} for c, v in crops.items() if v["area_ha"] > 0), key=lambda x: x["area_ha"], reverse=True
    )[:4]
    return {
        "user": {"name": user.name, "state": user.state, "district": user.district, "current_crop": user.current_crop},
        "recent_predictions": predictions,
        "latest_risk": {
            "crop": latest_risk["result"]["crop"],
            "score": latest_risk["result"]["score"],
            "level": latest_risk["result"]["level"],
            "main_causes": latest_risk["result"]["main_causes"],
            "created_at": latest_risk["created_at"].isoformat(),
        }
        if latest_risk
        else None,
        "weather": weather,
        "regional_insights": {"state": state, "census_year": regional["census_year"], "top_crops": top_regional},
        "sensor_readings": mongo.sensor_readings.count_documents({"user_id": user.id, "deleted": {"$ne": True}}),
    }
