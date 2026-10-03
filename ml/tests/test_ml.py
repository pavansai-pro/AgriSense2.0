from datetime import date, timedelta

import pytest

from agrisense_ml import train
from agrisense_ml.predictor import CropRecommender, SoilReading
from agrisense_ml.risk import ForecastDay, assess_risk


@pytest.fixture(scope="module")
def recommender(tmp_path_factory):
    out = tmp_path_factory.mktemp("artifacts")
    meta = train.run(train.DEFAULT_DATA, out)
    assert 0 <= meta["crop_model"]["ml_weight"] <= train.MAX_ML_WEIGHT
    return CropRecommender(out)


def test_rice_like_soil_prefers_rice(recommender):
    soil = SoilReading(n=100, p=50, k=50, temperature=28, moisture=85, ph=6.0)
    res = recommender.recommend(soil, "West Bengal", date(2026, 7, 1))
    assert res["recommended"] == "Rice"
    assert res["crops"][0]["in_season"]


def test_wheat_like_soil_prefers_wheat(recommender):
    soil = SoilReading(n=90, p=50, k=45, temperature=18, moisture=55, ph=7.0)
    assert recommender.recommend(soil, "Punjab", date(2026, 11, 10))["recommended"] == "Wheat"


def test_risk_low_for_ideal_conditions():
    soil = SoilReading(n=100, p=50, k=50, temperature=28, moisture=85, ph=6.0)
    days = [ForecastDay(date.today() + timedelta(days=i), 31, 24, 5, 70) for i in range(16)]
    res = assess_risk(soil, "Rice", days)
    assert res["level"] == "low"


def test_risk_high_for_bad_conditions():
    soil = SoilReading(n=10, p=5, k=5, temperature=40, moisture=10, ph=4.0)
    days = [ForecastDay(date.today() + timedelta(days=i), 44, 30, 0, 20) for i in range(16)]
    res = assess_risk(soil, "Wheat", days, date.today() - timedelta(days=30), date.today() + timedelta(days=10))
    assert res["level"] == "high"
    assert res["factors"][0]["contribution"] >= res["factors"][-1]["contribution"]


def test_risk_without_weather_excludes_factors():
    soil = SoilReading(n=90, p=45, k=50, temperature=26, moisture=75, ph=6.2)
    res = assess_risk(soil, "Maize", [])
    assert all(not f["available"] for f in res["factors"] if f["code"] in {"excess_rain", "dry_spell"})
