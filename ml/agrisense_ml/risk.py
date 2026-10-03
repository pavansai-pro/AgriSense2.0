"""Risk Calculation Engine.

Compares a crop's base agronomic profile with the farmer's current soil readings
and the weather forecast up to the planned harvest, and returns a 0-100 risk score
with an explanation per factor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from agrisense_ml.knowledge import CROP_PROFILES
from agrisense_ml.predictor import SoilReading
from agrisense_ml.scoring import TOLERANCE, nutrient_tolerance, range_distance

WEIGHTS = {
    "soil_ph": 0.13,
    "nutrients": 0.13,
    "soil_moisture": 0.12,
    "soil_temperature": 0.07,
    "temperature_stress": 0.15,
    "excess_rain": 0.12,
    "dry_spell": 0.09,
    "disease_pressure": 0.10,
    "harvest_timing": 0.09,
}
WEATHER_FACTORS = {"temperature_stress", "excess_rain", "dry_spell", "disease_pressure"}


@dataclass
class ForecastDay:
    date: date
    tmax: float
    tmin: float
    precip_mm: float = 0.0
    humidity: float | None = None
    wind_kmh: float | None = None


@dataclass
class Factor:
    code: str
    score: float
    detail: str
    tags: list[str] = field(default_factory=list)
    available: bool = True


def _clip(x: float) -> float:
    return max(0.0, min(1.0, x))


def _soil_factors(soil: SoilReading, prof: dict) -> list[Factor]:
    out = []
    lo, hi = prof["ph"]
    d = range_distance(soil.ph, lo, hi)
    if soil.ph < lo:
        detail, tags = f"Soil pH {soil.ph:.1f} is more acidic than the ideal {lo}-{hi}.", ["acidic soil", "lime"]
    elif soil.ph > hi:
        detail, tags = (
            f"Soil pH {soil.ph:.1f} is more alkaline than the ideal {lo}-{hi}.",
            ["alkaline soil", "gypsum", "sulphur"],
        )
    else:
        detail, tags = f"Soil pH {soil.ph:.1f} is within the ideal {lo}-{hi}.", []
    out.append(Factor("soil_ph", _clip(d / TOLERANCE["ph"]), detail, tags))

    gaps, notes, tags = [], [], []
    for key, label, val in (("N", "nitrogen", soil.n), ("P", "phosphorus", soil.p), ("K", "potassium", soil.k)):
        lo, hi = prof[key]
        dist = range_distance(val, lo, hi)
        gaps.append(_clip(dist / nutrient_tolerance(lo, hi)))
        if val < lo:
            notes.append(f"{label} low ({val:.0f} vs {lo}-{hi})")
            tags.append(f"{label} deficiency")
        elif val > hi:
            notes.append(f"{label} high ({val:.0f} vs {hi} max)")
            tags.append(f"excess {label}")
    detail = "Nutrients: " + ("; ".join(notes) if notes else "N, P and K are within crop needs") + "."
    out.append(Factor("nutrients", sum(gaps) / 3, detail, tags))

    lo, hi = prof["moisture"]
    d = range_distance(soil.moisture, lo, hi)
    if soil.moisture < lo:
        detail, tags = (
            f"Soil moisture {soil.moisture:.0f}% is below the ideal {lo}-{hi}%.",
            ["water stress", "irrigation", "mulching"],
        )
    elif soil.moisture > hi:
        detail, tags = (
            f"Soil moisture {soil.moisture:.0f}% is above the ideal {lo}-{hi}%.",
            ["waterlogging", "drainage"],
        )
    else:
        detail, tags = f"Soil moisture {soil.moisture:.0f}% is within the ideal {lo}-{hi}%.", []
    out.append(Factor("soil_moisture", _clip(d / TOLERANCE["moisture"]), detail, tags))

    lo, hi = prof["temp"]
    d = range_distance(soil.temperature, lo, hi)
    detail = (
        f"Soil temperature {soil.temperature:.0f}°C is outside the ideal {lo}-{hi}°C."
        if d
        else f"Soil temperature {soil.temperature:.0f}°C is within the ideal {lo}-{hi}°C."
    )
    out.append(
        Factor(
            "soil_temperature",
            _clip(d / TOLERANCE["temperature"]),
            detail,
            ["heat stress", "mulching"] if soil.temperature > hi else ["cold stress"] if d else [],
        )
    )
    return out


def _weather_factors(days: list[ForecastDay], prof: dict, soil: SoilReading) -> list[Factor]:
    if not days:
        return [
            Factor(code, 0.0, "Weather forecast unavailable; factor excluded.", [], available=False)
            for code in ("temperature_stress", "excess_rain", "dry_spell", "disease_pressure")
        ]
    n = len(days)
    heat = [d for d in days if d.tmax > prof["heat_limit"]]
    cold = [d for d in days if d.tmin < prof["cold_limit"]]
    excess = max([d.tmax - prof["heat_limit"] for d in heat] + [prof["cold_limit"] - d.tmin for d in cold] + [0])
    t_score = _clip((len(heat) + len(cold)) / n * 2 + excess / 10)
    if heat or cold:
        parts = []
        if heat:
            parts.append(f"{len(heat)} day(s) above {prof['heat_limit']}°C (peak {max(d.tmax for d in heat):.0f}°C)")
        if cold:
            parts.append(f"{len(cold)} day(s) below {prof['cold_limit']}°C (low {min(d.tmin for d in cold):.0f}°C)")
        t_detail = "Forecast shows " + " and ".join(parts) + f" in the next {n} days."
    else:
        t_detail = f"No damaging temperatures forecast in the next {n} days."
    t_tags = (["heat stress"] if heat else []) + (["cold stress", "frost"] if cold else [])

    limit = prof["max_daily_rain_mm"]
    heavy = [d for d in days if d.precip_mm > 0.6 * limit]
    peak = max(d.precip_mm for d in days)
    total = sum(d.precip_mm for d in days)
    r_score = _clip(len(heavy) / 3 + max(0.0, peak - limit) / limit)
    r_detail = (
        f"{len(heavy)} heavy-rain day(s) forecast (peak {peak:.0f} mm, total {total:.0f} mm); waterlogging possible."
        if heavy
        else f"Rainfall looks manageable (total {total:.0f} mm over {n} days)."
    )

    longest = run = 0
    for d in days:
        run = run + 1 if d.precip_mm < 1.0 else 0
        longest = max(longest, run)
    dry_soil = soil.moisture < sum(prof["moisture"]) / 2
    ds_score = _clip(max(0, longest - 5) / 10) * (1.0 if dry_soil else 0.5)
    ds_detail = f"Longest dry spell: {longest} days" + (" with already-dry soil." if dry_soil else ".")

    humid = [d for d in days if d.humidity is not None and d.humidity >= 85 and 18 <= (d.tmax + d.tmin) / 2 <= 30]
    dz_score = _clip(len(humid) / 5)
    dz_detail = (
        f"{len(humid)} warm, very humid day(s) favour fungal disease and pests."
        if humid
        else "Humidity does not favour fungal disease."
    )
    return [
        Factor("temperature_stress", t_score, t_detail, t_tags),
        Factor("excess_rain", r_score, r_detail, ["waterlogging", "drainage", "heavy rain"] if heavy else []),
        Factor("dry_spell", ds_score, ds_detail, ["water stress", "irrigation"] if ds_score > 0.2 else []),
        Factor("disease_pressure", dz_score, dz_detail, ["fungal disease", "blight", "pest"] if humid else []),
    ]


def _harvest_factor(prof: dict, sowing: date | None, harvest: date | None, days: list[ForecastDay]) -> Factor:
    if not harvest:
        return Factor("harvest_timing", 0.0, "No planned harvest date given; factor excluded.", available=False)
    score, notes, tags = 0.0, [], []
    lo, hi = prof["duration_days"]
    if sowing:
        age = (harvest - sowing).days
        if age < lo:
            score = max(score, _clip((lo - age) / 30))
            notes.append(f"harvest planned {lo - age} day(s) before the crop matures ({lo}-{hi} days)")
            tags.append("early harvest")
        elif age > hi + 15:
            score = max(score, _clip((age - hi) / 45))
            notes.append(f"harvest planned {age - hi} day(s) after normal maturity")
            tags.append("late harvest")
    window = [d for d in days if abs((d.date - harvest).days) <= 2]
    wet = [d for d in window if d.precip_mm >= 10]
    if wet:
        score = max(score, _clip(len(wet) / 3 + 0.3))
        notes.append(f"{len(wet)} rainy day(s) forecast around the harvest date")
        tags += ["harvest rain", "post-harvest storage"]
    detail = ("Harvest timing: " + "; ".join(notes) + ".") if notes else "Harvest timing looks fine."
    return Factor("harvest_timing", score, detail, tags)


def assess_risk(
    soil: SoilReading,
    crop: str,
    forecast: list[ForecastDay] | None = None,
    sowing_date: date | None = None,
    planned_harvest: date | None = None,
) -> dict:
    if crop not in CROP_PROFILES:
        raise ValueError(f"Unknown crop '{crop}'. Choose one of {sorted(CROP_PROFILES)}")
    prof = CROP_PROFILES[crop]
    days = list(forecast or [])
    if planned_harvest:
        days = [d for d in days if d.date <= planned_harvest]
    factors = (
        _soil_factors(soil, prof)
        + _weather_factors(days, prof, soil)
        + [_harvest_factor(prof, sowing_date, planned_harvest, list(forecast or []))]
    )
    total_w = sum(WEIGHTS[f.code] for f in factors if f.available)
    score = 100 * sum(WEIGHTS[f.code] * f.score for f in factors if f.available) / total_w
    level = "low" if score < 30 else "moderate" if score < 60 else "high"
    rows = [
        {
            "code": f.code,
            "score": round(f.score, 3),
            "weight": round(WEIGHTS[f.code] / total_w, 3) if f.available else 0.0,
            "contribution": round(100 * WEIGHTS[f.code] * f.score / total_w, 1) if f.available else 0.0,
            "detail": f.detail,
            "tags": f.tags,
            "available": f.available,
        }
        for f in factors
    ]
    rows.sort(key=lambda r: r["contribution"], reverse=True)
    causes = [r for r in rows if r["contribution"] >= 3]
    return {
        "crop": crop,
        "score": round(score, 1),
        "level": level,
        "factors": rows,
        "main_causes": [r["detail"] for r in causes[:3]],
        "query_tags": sorted({t for r in causes for t in r["tags"]}),
        "forecast_days_used": len(days),
    }
