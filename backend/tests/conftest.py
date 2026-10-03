import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["MONGO_URL"] = "mongomock://"
os.environ["JWT_SECRET"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    db = Path("test.db")
    db.unlink(missing_ok=True)
    from app.main import app

    with TestClient(app) as c:
        yield c
    db.unlink(missing_ok=True)


@pytest.fixture(scope="session")
def auth(client):
    r = client.post(
        "/api/auth/register",
        json={
            "name": "Ramesh",
            "phone": "9876543210",
            "pin": "1234",
            "state": "Telangana",
            "district": "Warangal",
        },
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(autouse=True)
def offline_weather(monkeypatch):
    from app.services import weather

    def fake(lat, lon, days):
        from datetime import date, timedelta

        today = date.today()
        return [
            {
                "date": (today + timedelta(days=i)).isoformat(),
                "tmax": 41 if i < 3 else 30,
                "tmin": 22,
                "precip_mm": 90 if i == 5 else 0,
                "humidity": 90 if i in (6, 7, 8) else 60,
                "wind_kmh": 10,
                "condition": "Clear",
                "rain_chance": 10,
            }
            for i in range(days)
        ]

    monkeypatch.setattr(weather, "_open_meteo", fake)
    monkeypatch.setattr(weather, "_geocode_district", lambda d, s: None)
