"""16-day forecast with OpenWeather (if a key is configured) and Open-Meteo fallback.

Results are cached in PostgreSQL (weather_cache) so repeat requests and offline-ish
situations are served from structured storage.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from agrisense_ml.knowledge import STATE_COORDS, normalize_state
from agrisense_ml.risk import ForecastDay
from app.core.config import get_settings
from app.models.sql import WeatherCache
from app.services.ml import load_artifact

log = logging.getLogger(__name__)

WMO = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with hail",
}


class LocationError(ValueError):
    pass


def _geocode_district(district: str, state: str | None) -> tuple[float, float] | None:
    try:
        r = httpx.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": district, "count": 10, "country_code": "IN", "language": "en"},
            timeout=6,
        )
        r.raise_for_status()
        results = r.json().get("results") or []
    except httpx.HTTPError:
        return None
    for res in results:
        if not state or normalize_state(res.get("admin1")) == state:
            return float(res["latitude"]), float(res["longitude"])
    return None


def resolve_location(
    state: str | None, district: str | None, lat: float | None, lon: float | None
) -> tuple[float, float, str]:
    if lat is not None and lon is not None:
        return lat, lon, f"{lat:.2f}, {lon:.2f}"
    st = normalize_state(state)
    if district:
        coords = _geocode_district(district, st)
        if coords:
            return coords[0], coords[1], f"{district}, {st or ''}".strip(", ")
    if st:
        la, lo = STATE_COORDS[st]
        return la, lo, st
    raise LocationError("Provide a state, district or coordinates")


def _openweather(lat: float, lon: float, key: str, days: int) -> list[dict]:
    r = httpx.get(
        "https://api.openweathermap.org/data/2.5/forecast/daily",
        params={"lat": lat, "lon": lon, "cnt": days, "units": "metric", "appid": key},
        timeout=8,
    )
    r.raise_for_status()
    out = []
    for d in r.json()["list"]:
        out.append(
            {
                "date": datetime.fromtimestamp(d["dt"], timezone.utc).date().isoformat(),
                "tmax": d["temp"]["max"],
                "tmin": d["temp"]["min"],
                "precip_mm": float(d.get("rain", 0.0)),
                "humidity": d.get("humidity"),
                "wind_kmh": round(d.get("speed", 0.0) * 3.6, 1),
                "condition": (d.get("weather") or [{}])[0].get("main", ""),
                "rain_chance": round(100 * d.get("pop", 0)),
            }
        )
    return out


def _open_meteo(lat: float, lon: float, days: int) -> list[dict]:
    r = httpx.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "forecast_days": days,
            "timezone": "Asia/Kolkata",
            "daily": ",".join(
                [
                    "weather_code",
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_sum",
                    "relative_humidity_2m_mean",
                    "wind_speed_10m_max",
                    "precipitation_probability_max",
                ]
            ),
        },
        timeout=8,
    )
    r.raise_for_status()
    d = r.json()["daily"]
    return [
        {
            "date": d["time"][i],
            "tmax": d["temperature_2m_max"][i],
            "tmin": d["temperature_2m_min"][i],
            "precip_mm": d["precipitation_sum"][i] or 0.0,
            "humidity": d["relative_humidity_2m_mean"][i],
            "wind_kmh": d["wind_speed_10m_max"][i],
            "condition": WMO.get(d["weather_code"][i], "Unknown"),
            "rain_chance": d["precipitation_probability_max"][i],
        }
        for i in range(len(d["time"]))
    ]


def get_forecast(
    db: Session,
    state: str | None = None,
    district: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    days: int = 16,
) -> dict:
    s = get_settings()
    la, lo, label = resolve_location(state, district, lat, lon)
    key = f"{la:.2f}:{lo:.2f}:{days}"
    st = normalize_state(state)
    baseline = load_artifact("weather_baseline.json").get(st or "", None)

    cached = db.get(WeatherCache, key)
    fresh_after = datetime.now(timezone.utc) - timedelta(minutes=s.weather_cache_minutes)
    if cached and cached.fetched_at.replace(tzinfo=cached.fetched_at.tzinfo or timezone.utc) > fresh_after:
        return {**cached.payload, "cached": True}

    provider, daily = None, []
    if s.openweather_api_key:
        try:
            daily, provider = _openweather(la, lo, s.openweather_api_key, days), "openweather"
        except (httpx.HTTPError, KeyError) as e:
            log.warning("OpenWeather failed (%s); falling back to Open-Meteo", e)
    if not daily:
        try:
            daily, provider = _open_meteo(la, lo, days), "open-meteo"
        except (httpx.HTTPError, KeyError) as e:
            log.warning("Open-Meteo failed: %s", e)

    if not daily:
        if cached:
            return {**cached.payload, "cached": True, "stale": True}
        return {
            "location": label,
            "lat": la,
            "lon": lo,
            "provider": "baseline",
            "days": [],
            "baseline": baseline,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    payload = {
        "location": label,
        "lat": la,
        "lon": lo,
        "provider": provider,
        "days": daily,
        "baseline": baseline,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    if cached:
        cached.payload, cached.provider, cached.fetched_at = payload, provider, datetime.now(timezone.utc)
    else:
        db.add(WeatherCache(key=key, provider=provider, latitude=la, longitude=lo, payload=payload))
    db.commit()
    return {**payload, "cached": False}


def to_forecast_days(payload: dict) -> list[ForecastDay]:
    return [
        ForecastDay(
            date=date.fromisoformat(d["date"]),
            tmax=d["tmax"],
            tmin=d["tmin"],
            precip_mm=d.get("precip_mm") or 0.0,
            humidity=d.get("humidity"),
            wind_kmh=d.get("wind_kmh"),
        )
        for d in payload.get("days", [])
        if d.get("tmax") is not None and d.get("tmin") is not None
    ]
