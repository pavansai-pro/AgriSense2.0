"""Serve crop recommendations from the trained artifacts."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from agrisense_ml.knowledge import CROP_PROFILES, normalize_state
from agrisense_ml.scoring import TOLERANCE, nutrient_tolerance, range_score
from agrisense_ml.train import DEFAULT_OUT

REGION_WEIGHT = 0.2
OFF_SEASON_FACTOR = 0.85
FEATURE_LABELS = {
    "n": "Nitrogen",
    "p": "Phosphorus",
    "k": "Potassium",
    "temperature": "Soil temperature",
    "moisture": "Soil moisture",
    "ph": "Soil pH",
}


@dataclass
class SoilReading:
    n: float
    p: float
    k: float
    temperature: float
    moisture: float
    ph: float

    def as_dict(self) -> dict[str, float]:
        return {
            "n": self.n,
            "p": self.p,
            "k": self.k,
            "temperature": self.temperature,
            "moisture": self.moisture,
            "ph": self.ph,
        }


def agronomic_scores(soil: SoilReading, crop: str) -> dict[str, float]:
    prof = CROP_PROFILES[crop]
    values = soil.as_dict()
    scores = {}
    for nut, key in (("n", "N"), ("p", "P"), ("k", "K")):
        low, high = prof[key]
        scores[nut] = range_score(values[nut], low, high, nutrient_tolerance(low, high))
    scores["ph"] = range_score(values["ph"], *prof["ph"], TOLERANCE["ph"])
    scores["temperature"] = range_score(values["temperature"], *prof["temp"], TOLERANCE["temperature"])
    scores["moisture"] = range_score(values["moisture"], *prof["moisture"], TOLERANCE["moisture"])
    return scores


class CropRecommender:
    def __init__(self, artifacts_dir: Path | str = DEFAULT_OUT):
        self.dir = Path(artifacts_dir)
        bundle = joblib.load(self.dir / "crop_model.joblib")
        self.model = bundle["model"]
        self.features = bundle["features"]
        self.metadata = json.loads((self.dir / "metadata.json").read_text())
        self.regional = json.loads((self.dir / "regional_prior.json").read_text())
        self.ml_weight = float(self.metadata["crop_model"]["ml_weight"])

    def _ml_probs(self, soil: SoilReading) -> dict[str, float]:
        x = pd.DataFrame([soil.as_dict()])[self.features]
        probs = self.model.predict_proba(x)[0]
        return dict(zip(self.model.classes_, probs.tolist(), strict=True))

    def recommend(
        self,
        soil: SoilReading,
        state: str | None = None,
        sowing_date: date | None = None,
        top_k: int = 5,
    ) -> dict:
        sowing_date = sowing_date or date.today()
        state_key = normalize_state(state)
        regional = self.regional["states"].get(state_key or "", {})
        ml_probs = self._ml_probs(soil)
        n_ml = len(ml_probs)

        results = []
        for crop, prof in CROP_PROFILES.items():
            parts = agronomic_scores(soil, crop)
            agro = float(np.mean(list(parts.values())))
            w_ml = self.ml_weight if crop in ml_probs else 0.0
            # Scale probabilities so chance level maps to 0.5 and certainty to 1.0.
            ml = min(1.0, ml_probs.get(crop, 0.0) * n_ml / 2) if crop in ml_probs else 0.0
            w_reg = REGION_WEIGHT if regional else 0.0
            reg = regional.get(crop, {}).get("score", 0.0)
            w_agro = 1.0 - w_ml - w_reg
            score = w_agro * agro + w_ml * ml + w_reg * reg
            in_season = sowing_date.month in prof["sowing_months"]
            if not in_season:
                score *= OFF_SEASON_FACTOR
            lo_y, hi_y = prof["yield_t_ha"]
            d_lo, d_hi = prof["duration_days"]
            limiting = sorted(parts.items(), key=lambda kv: kv[1])[:2]
            results.append(
                {
                    "crop": crop,
                    "score": round(100 * score, 1),
                    "components": {
                        "agronomic": {"value": round(agro, 3), "weight": round(w_agro, 3)},
                        "ml_model": {"value": round(ml, 3), "weight": round(w_ml, 3)},
                        "regional": {"value": round(reg, 3), "weight": round(w_reg, 3)},
                    },
                    "feature_fit": {k: round(v, 3) for k, v in parts.items()},
                    "limiting_factors": [FEATURE_LABELS[k] for k, v in limiting if v < 0.8],
                    "yield_potential_t_ha": round(lo_y + (hi_y - lo_y) * agro, 1),
                    "yield_range_t_ha": [lo_y, hi_y],
                    "in_season": in_season,
                    "sowing_months": prof["sowing_months"],
                    "harvest_window": {
                        "earliest": (sowing_date + timedelta(days=d_lo)).isoformat(),
                        "latest": (sowing_date + timedelta(days=d_hi)).isoformat(),
                        "duration_days": [d_lo, d_hi],
                    },
                    "regional_share_pct": regional.get(crop, {}).get("share_pct"),
                }
            )
        results.sort(key=lambda r: r["score"], reverse=True)
        cm = self.metadata["crop_model"]
        return {
            "recommended": results[0]["crop"],
            "crops": results[:top_k],
            "state": state_key,
            "sowing_date": sowing_date.isoformat(),
            "model": {
                "accuracy": cm["accuracy"],
                "chance_accuracy": cm["chance_accuracy"],
                "ml_weight": self.ml_weight,
                "census_year": self.regional.get("census_year"),
                "data_quality_warning": cm.get("data_quality_warning"),
            },
        }
