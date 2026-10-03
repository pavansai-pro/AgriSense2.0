"""Train the AgriSense crop model and build the derived data artifacts.

Usage: python -m agrisense_ml.train [--data-dir ml/data/raw] [--out ml/artifacts]
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split

from agrisense_ml.knowledge import CROP_PROFILES, normalize_state

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "raw"
DEFAULT_OUT = ROOT / "artifacts"

FEATURES = ["n", "p", "k", "temperature", "moisture", "ph"]
SENSOR_COLUMNS = {
    "Nitrogen": "n",
    "Phosphorus": "p",
    "Potassium": "k",
    "Temperature": "temperature",
    "Humidity": "moisture",
    "pH_Value": "ph",
    "Crop": "crop",
    "Soil_Type": "soil_type",
}
MAX_ML_WEIGHT = 0.5


def _find(data_dir: Path, stem: str) -> Path:
    for candidate in (data_dir / f"{stem}.csv", data_dir / f"{stem}.csv.gz"):
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"{stem}.csv(.gz) not found in {data_dir}")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def train_crop_model(sensor_csv: Path, seed: int = 42) -> tuple[RandomForestClassifier, dict]:
    df = pd.read_csv(sensor_csv).rename(columns=SENSOR_COLUMNS)
    df = df.dropna(subset=FEATURES + ["crop"])
    X, y = df[FEATURES], df["crop"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=seed, stratify=y)
    model = RandomForestClassifier(n_estimators=120, max_depth=10, min_samples_leaf=5, n_jobs=-1, random_state=seed)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, pred))
    chance = 1.0 / y.nunique()
    skill = max(0.0, (accuracy - chance) / (1.0 - chance))
    class_means = df.groupby("crop")[FEATURES].mean().round(2)
    metrics = {
        "rows": int(len(df)),
        "classes": sorted(y.unique().tolist()),
        "accuracy": round(accuracy, 4),
        "macro_f1": round(float(f1_score(y_test, pred, average="macro")), 4),
        "chance_accuracy": round(chance, 4),
        "skill_over_chance": round(skill, 4),
        "ml_weight": round(min(MAX_ML_WEIGHT, skill), 4),
        "feature_importance": dict(zip(FEATURES, np.round(model.feature_importances_, 4).tolist(), strict=True)),
        "class_feature_means": class_means.to_dict(orient="index"),
        "report": classification_report(y_test, pred, output_dict=True, zero_division=0),
    }
    max_spread = float((class_means.max() - class_means.min()).div(df[FEATURES].std()).max())
    metrics["max_class_mean_spread_in_std"] = round(max_spread, 4)
    metrics["data_quality_warning"] = (
        "Per-crop feature means are nearly identical and the model performs at chance level; "
        "the sensor dataset carries little crop-specific signal, so the recommender relies on "
        "agronomic profiles and regional census data instead."
        if skill < 0.05
        else None
    )
    return model, metrics


def build_regional_prior(census_csv: Path) -> dict:
    cols = ["year", "state_name", "crop_name", "total_ar_state"]
    df = pd.read_csv(census_csv, usecols=cols)
    latest = sorted(df["year"].unique())[-1]
    df = df[df["year"] == latest]
    state_total = df.groupby("state_name")["total_ar_state"].sum()
    name_to_crop = {n: crop for crop, p in CROP_PROFILES.items() for n in p["census_names"]}
    ours = df[df["crop_name"].isin(name_to_crop)].copy()
    ours["crop"] = ours["crop_name"].map(name_to_crop)
    area = ours.groupby(["state_name", "crop"])["total_ar_state"].sum()

    prior: dict[str, dict] = {}
    for state in state_total.index:
        key = normalize_state(state) or state
        crops = area.get(state, pd.Series(dtype=float))
        top = float(crops.max()) if len(crops) else 0.0
        prior[key] = {
            crop: {
                "area_ha": round(float(crops.get(crop, 0.0)), 2),
                "share_pct": round(100 * float(crops.get(crop, 0.0)) / float(state_total[state]), 3)
                if state_total[state]
                else 0.0,
                "score": round(float(crops.get(crop, 0.0)) / top, 4) if top else 0.0,
            }
            for crop in CROP_PROFILES
        }
    return {"census_year": str(latest), "states": prior}


def build_weather_baseline(weather_csv: Path) -> tuple[dict, dict]:
    df = pd.read_csv(weather_csv).rename(
        columns={
            "State/UT": "state",
            "District": "district",
            "Temperature (°C)": "temp_c",
            "Condition": "condition",
            "Humidity (%)": "humidity",
            "Wind Speed (km/h)": "wind_kmh",
            "Last Updated": "updated",
        }
    )
    df["state"] = df["state"].map(lambda s: normalize_state(s) or s)
    baseline, locations = {}, {}
    for state, g in df.groupby("state"):
        baseline[state] = {
            "temp_c": round(float(g["temp_c"].mean()), 1),
            "humidity": round(float(g["humidity"].mean()), 1),
            "wind_kmh": round(float(g["wind_kmh"].mean()), 1),
            "condition": g["condition"].mode().iat[0],
            "districts": int(g["district"].nunique()),
            "observed": str(g["updated"].iloc[0]),
        }
        locations[state] = sorted(g["district"].dropna().unique().tolist())
    return baseline, locations


def run(data_dir: Path = DEFAULT_DATA, out_dir: Path = DEFAULT_OUT) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    sensor = _find(data_dir, "sensor_crop_dataset")
    census = _find(data_dir, "state-level-agcensus-crop")
    weather = _find(data_dir, "weather-1")

    model, metrics = train_crop_model(sensor)
    joblib.dump({"model": model, "features": FEATURES}, out_dir / "crop_model.joblib", compress=3)
    (out_dir / "regional_prior.json").write_text(json.dumps(build_regional_prior(census), indent=1))
    baseline, locations = build_weather_baseline(weather)
    (out_dir / "weather_baseline.json").write_text(json.dumps(baseline, indent=1))
    (out_dir / "locations.json").write_text(json.dumps(locations, indent=1, ensure_ascii=False))

    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "sklearn_version": sklearn.__version__,
        "features": FEATURES,
        "datasets": {p.name: _sha256(p) for p in (sensor, census, weather)},
        "crop_model": {k: v for k, v in metrics.items() if k != "report"},
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=1))
    (out_dir / "classification_report.json").write_text(json.dumps(metrics["report"], indent=1))
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    meta = run(args.data_dir, args.out)
    m = meta["crop_model"]
    print(
        f"crop model: accuracy={m['accuracy']} chance={m['chance_accuracy']} "
        f"ml_weight={m['ml_weight']} -> artifacts in {args.out}"
    )
    if m["data_quality_warning"]:
        print("WARNING:", m["data_quality_warning"])


if __name__ == "__main__":
    main()
