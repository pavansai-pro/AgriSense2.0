from datetime import date, datetime, timedelta, timezone

SOIL = {"n": 90, "p": 45, "k": 50, "moisture": 75, "temperature": 26, "ph": 6.2}


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["postgres"] == "ok" and r.json()["mongo"] == "ok"


def test_auth_flow(client, auth):
    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers=auth).json()
    assert me["phone"] == "9876543210"
    r = client.post("/api/auth/login", data={"username": "+91 98765 43210", "password": "1234"})
    assert r.status_code == 200
    refreshed = client.post("/api/auth/refresh", json={"refresh_token": r.json()["refresh_token"]})
    assert refreshed.status_code == 200
    assert client.post("/api/auth/login", data={"username": "9876543210", "password": "0000"}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": r.json()["access_token"]}).status_code == 401
    upd = client.patch("/api/auth/me", headers=auth, json={"language": "te", "theme": "dark"})
    assert upd.json()["language"] == "te"


def test_duplicate_register(client, auth):
    r = client.post("/api/auth/register", json={"name": "X", "phone": "9876543210", "pin": "9999"})
    assert r.status_code == 409


def test_crop_predict(client, auth):
    r = client.post("/api/crops/predict", headers=auth, json={**SOIL, "state": "Punjab", "sowing_date": "2026-11-10"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["crops"]) == 5
    assert body["crops"][0]["score"] >= body["crops"][-1]["score"]
    assert body["model"]["ml_weight"] == 0.0
    hist = client.get("/api/crops/history", headers=auth).json()
    assert hist[0]["recommended"] == body["recommended"]


def test_weather_forecast(client, auth):
    assert client.get("/api/weather/forecast", params={"state": "Telangana"}).status_code == 401
    r = client.get("/api/weather/forecast", params={"state": "Telangana"}, headers=auth)
    assert r.status_code == 200
    assert len(r.json()["days"]) == 16
    assert r.json()["provider"] == "open-meteo"
    again = client.get("/api/weather/forecast", params={"state": "Telangana"}, headers=auth).json()
    assert again["cached"] is True
    # Same rounded coordinates, different request: label comes from this request, not the cache.
    lat, lon = r.json()["lat"], r.json()["lon"]
    by_coords = client.get("/api/weather/forecast", params={"lat": lat, "lon": lon}, headers=auth).json()
    assert by_coords["cached"] is True
    assert by_coords["location"] != r.json()["location"]
    assert client.get("/api/weather/forecast", headers=auth).status_code == 422


def test_risk_assess(client, auth):
    harvest = (date.today() + timedelta(days=10)).isoformat()
    sowing = (date.today() - timedelta(days=60)).isoformat()
    r = client.post(
        "/api/risk/assess",
        headers=auth,
        json={
            **SOIL,
            "ph": 4.6,
            "crop": "Wheat",
            "state": "Telangana",
            "sowing_date": sowing,
            "planned_harvest": harvest,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert 0 <= body["score"] <= 100
    codes = {f["code"]: f for f in body["factors"]}
    assert codes["soil_ph"]["score"] > 0.5
    assert codes["temperature_stress"]["score"] > 0
    assert codes["harvest_timing"]["score"] > 0
    assert body["prevention"], "expected RAG prevention steps"
    assert any("lime" in p["text"].lower() for p in body["prevention"])
    assert client.post("/api/risk/assess", headers=auth, json={**SOIL, "crop": "Mango"}).status_code == 422


def test_chat_rag(client, auth):
    r = client.post("/api/chat", headers=auth, json={"message": "How do I prevent blight in tomato?", "lang": "en"})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "extractive"
    assert body["sources"]
    hist = client.get("/api/chat/history", headers=auth, params={"session_id": body["session_id"]}).json()
    assert [m["role"] for m in hist] == ["user", "assistant"]


def test_offline_sync_roundtrip(client, auth):
    t0 = datetime.now(timezone.utc)
    records = [
        {"client_id": "soil-1", "kind": "soil_reading", "payload": SOIL, "updated_at": t0.isoformat()},
        {
            "client_id": "harv-1",
            "kind": "harvest_record",
            "updated_at": t0.isoformat(),
            "payload": {"crop": "Rice", "area_acres": 2, "sowing_date": "2026-06-20"},
        },
        {"client_id": "bad-1", "kind": "soil_reading", "payload": {"n": "x"}, "updated_at": t0.isoformat()},
    ]
    r = client.post("/api/sync/push", headers=auth, json={"records": records}).json()
    assert [x["status"] for x in r["results"]] == ["created", "created", "error"]
    again = client.post("/api/sync/push", headers=auth, json={"records": records[:2]}).json()
    assert [x["status"] for x in again["results"]] == ["skipped_stale", "skipped_stale"]
    newer = {
        **records[1],
        "updated_at": (t0 + timedelta(minutes=1)).isoformat(),
        "payload": {"crop": "Rice", "yield_quintals": 40},
    }
    assert (
        client.post("/api/sync/push", headers=auth, json={"records": [newer]}).json()["results"][0]["status"]
        == "updated"
    )
    pulled = client.get("/api/sync/pull", headers=auth).json()["records"]
    assert {p["client_id"] for p in pulled} == {"soil-1", "harv-1"}
    assert next(p for p in pulled if p["client_id"] == "harv-1")["payload"]["yield_quintals"] == 40


def test_dashboard_and_meta(client, auth):
    d = client.get("/api/dashboard", headers=auth).json()
    assert d["recent_predictions"] and d["latest_risk"]
    assert d["regional_insights"]["state"] == "Telangana"
    assert len(d["weather"]["days"]) == 5
    loc = client.get("/api/meta/locations").json()
    assert any(s["name"] == "Telangana" and s["districts"] for s in loc["states"])
    assert client.post(
        "/api/voice/logs",
        headers=auth,
        json=[{"transcript": "open weather", "lang": "en-IN", "intent": "weather", "matched": True}],
    ).json() == {"stored": 1}
