import json
import logging
from functools import lru_cache

import sklearn

from agrisense_ml import train
from agrisense_ml.predictor import CropRecommender
from app.core.config import get_settings

log = logging.getLogger(__name__)

# Keep a single in-memory recommender instance for startup performance
_recommender_cache: CropRecommender | None = None
_artifact_cache: dict[str, dict] = {}


def ensure_artifacts() -> None:
    s = get_settings()
    meta = s.ml_artifacts_dir / "metadata.json"
    if (s.ml_artifacts_dir / "crop_model.joblib").exists() and meta.exists():
        if json.loads(meta.read_text()).get("sklearn_version") == sklearn.__version__:
            return
    log.info("Training ML artifacts from %s (missing or built with another scikit-learn)", s.ml_data_dir)
    train.run(s.ml_data_dir, s.ml_artifacts_dir)


def get_recommender() -> CropRecommender:
    global _recommender_cache
    if _recommender_cache is None:
        ensure_artifacts()
        _recommender_cache = CropRecommender(get_settings().ml_artifacts_dir)
    return _recommender_cache


@lru_cache(maxsize=16)
def load_artifact(name: str) -> dict:
    ensure_artifacts()
    return json.loads((get_settings().ml_artifacts_dir / name).read_text())


def clear_caches() -> None:
    global _recommender_cache
    _recommender_cache = None
