from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pymongo.database import Database

from agrisense_ml.knowledge import CROP_PROFILES
from agrisense_ml.predictor import SoilReading
from app.db.mongo import get_mongo
from app.deps import get_current_user
from app.models.sql import User
from app.schemas import CropPredictIn
from app.services.ml import get_recommender

router = APIRouter(prefix="/api/crops", tags=["crops"])


@router.post("/predict")
def predict(body: CropPredictIn, user: User = Depends(get_current_user), mongo: Database = Depends(get_mongo)) -> dict:
    soil = SoilReading(body.n, body.p, body.k, body.temperature, body.moisture, body.ph)
    result = get_recommender().recommend(soil, body.state or user.state, body.sowing_date)
    doc = {
        "user_id": user.id,
        "client_id": body.client_id,
        "input": body.model_dump(mode="json", exclude={"client_id"}),
        "result": result,
        "created_at": datetime.now(timezone.utc),
    }
    inserted = mongo.predictions.insert_one(doc)
    return {**result, "id": str(inserted.inserted_id)}


@router.get("/history")
def history(limit: int = 10, user: User = Depends(get_current_user), mongo: Database = Depends(get_mongo)) -> list:
    cur = mongo.predictions.find({"user_id": user.id}).sort("created_at", -1).limit(min(limit, 50))
    return [
        {
            "id": str(d["_id"]),
            "created_at": d["created_at"].isoformat(),
            "input": d["input"],
            "recommended": d["result"]["recommended"],
            "top": [{"crop": c["crop"], "score": c["score"]} for c in d["result"]["crops"][:3]],
        }
        for d in cur
    ]


@router.get("/profiles")
def profiles() -> dict:
    return {crop: {k: v for k, v in p.items() if k != "census_names"} for crop, p in CROP_PROFILES.items()}
