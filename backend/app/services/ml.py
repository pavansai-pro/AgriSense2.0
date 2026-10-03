import json
import logging
from functools import lru_cache

import sklearn

from agrisense_ml import train
from agrisense_ml.predictor import CropRecommender
from app.core.config import get_settings

log = logging.getLogger(__name__)


def ensure_artifacts() -> None:
    s = get_settings()
    meta = s.ml_artifacts_dir / "metadata.json"
    if (s.ml_artifacts_dir / "crop_model.joblib").exists() and meta.exists():
        if json.loads(meta.read_text()).get("sklearn_version") == sklearn.__version__:
            return
    log.info("Training ML artifacts from %s (missing or built with another scikit-learn)", s.ml_data_dir)
    train.run(s.ml_data_dir, s.ml_artifacts_dir)


@lru_cache
def get_recommender() -> CropRecommender:
    ensure_artifacts()
    return CropRecommender(get_settings().ml_artifacts_dir)


@lru_cache
def load_artifact(name: str) -> dict:
    ensure_artifacts()
    return json.loads((get_settings().ml_artifacts_dir / name).read_text())
