from fastapi import APIRouter
from sqlalchemy import text

from agrisense_ml.knowledge import CROP_PROFILES, STATE_COORDS
from app.db.mongo import get_mongo
from app.db.postgres import engine
from app.services.ml import load_artifact

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/meta/locations")
def locations() -> dict:
    districts = load_artifact("locations.json")
    return {
        "states": [{"name": s, "districts": districts.get(s, [])} for s in sorted(STATE_COORDS)],
        "crops": sorted(CROP_PROFILES),
    }


@router.get("/health")
def health() -> dict:
    status = {"postgres": "ok", "mongo": "ok"}
    try:
        with engine.connect() as c:
            c.execute(text("select 1"))
    except Exception as e:  # noqa: BLE001
        status["postgres"] = f"error: {type(e).__name__}"
    try:
        get_mongo().command("ping")
    except Exception as e:  # noqa: BLE001
        status["mongo"] = f"error: {type(e).__name__}"
    model = load_artifact("metadata.json")["crop_model"]
    status["model"] = {"accuracy": model["accuracy"], "ml_weight": model["ml_weight"]}
    return status
