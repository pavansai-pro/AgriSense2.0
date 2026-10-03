import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier
import pandas as pd
import numpy as np
import requests

app = FastAPI(title="AgriSense Crop Predictor")

# Serve static frontend from local workspace
from fastapi.staticfiles import StaticFiles
app.mount('/', StaticFiles(directory='.', html=True), name='static')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==== Data model ====
class FarmUser(BaseModel):
    name: str
    email: str
    phone: str
    state: str
    district: str
    pin_code: str
    acres: float
    current_crop: Optional[str] = None

class SensorInput(BaseModel):
    n: float
    p: float
    k: float
    ph: float
    ec: float
    temp: float
    moisture: float
    lat: float
    lon: float
    rainfall_history: Optional[float] = None

class PredictionResponse(BaseModel):
    top_crops: List[str]
    probabilities: List[float]
    recommended: str
    risk_score: float
    risk_level: str
    insurance: str
    reasons: List[str]
    precautions: List[str]
    weather_current: Optional[str]
    previous_analyses: List[dict]

# ==== Build sample dataset (can be replaced with database or CSV) ====
CROP_SPEC = {
    "Rice": {"N": 100, "P": 50, "K": 50, "pH": (5.5, 6.5), "EC": 2.5, "temp": (24, 32), "moisture": (70, 90)},
    "Wheat": {"N": 80, "P": 45, "K": 45, "pH": (6.0, 7.0), "EC": 1.7, "temp": (10, 28), "moisture": (50, 70)},
    "Maize": {"N": 90, "P": 50, "K": 55, "pH": (5.8, 7.0), "EC": 2.0, "temp": (18, 32), "moisture": (60, 80)},
    "Cotton": {"N": 72, "P": 48, "K": 54, "pH": (6.0, 7.5), "EC": 1.8, "temp": (21, 32), "moisture": (45, 65)},
    "Sugarcane": {"N": 120, "P": 60, "K": 80, "pH": (6.0, 7.5), "EC": 2.4, "temp": (20, 35), "moisture": (70, 95)},
    "Soybean": {"N": 40, "P": 40, "K": 50, "pH": (6.0, 7.2), "EC": 1.5, "temp": (20, 30), "moisture": (50, 80)},
    "Groundnut": {"N": 60, "P": 45, "K": 45, "pH": (5.5, 6.5), "EC": 1.4, "temp": (20, 32), "moisture": (45, 70)},
    "Tomato": {"N": 70, "P": 50, "K": 70, "pH": (5.8, 6.8), "EC": 1.8, "temp": (18, 30), "moisture": (60, 80)},
}

# Build training DataFrame
rows = []
for crop, spec in CROP_SPEC.items():
    for _ in range(25):
        rows.append({
            "N": np.clip(np.random.normal(spec['N'], 8), 10, 200),
            "P": np.clip(np.random.normal(spec['P'], 5), 5, 150),
            "K": np.clip(np.random.normal(spec['K'], 8), 5, 200),
            "pH": np.clip(np.random.normal(np.mean(spec['pH']), 0.3), 4.5, 8.5),
            "EC": np.clip(np.random.normal(spec['EC'], 0.4), 0.3, 5),
            "Temp": np.clip(np.random.normal(np.mean(spec['temp']), 4), 5, 45),
            "Moisture": np.clip(np.random.normal(np.mean(spec['moisture']), 8), 5, 100),
            "Rainfall": np.random.randint(400, 1700),
            "Crop": crop,
        })

df = pd.DataFrame(rows)

model = RandomForestClassifier(n_estimators=150, random_state=42)
model.fit(df.drop('Crop', axis=1), df['Crop'])

# In-memory previous analyses
history = []

# ==== Utility functions ====
def risk_eval(sensor: SensorInput, chosen_crop: str):
    # Weighted linear combination
    w = {
        'EC': 0.20,
        'pH': 0.20,
        'NPK': 0.20,
        'Temp': 0.15,
        'Moisture': 0.15,
        'Rainfall': 0.10,
    }
    score = 0.0
    reasons = []
    precautions = []

    crop_spec = CROP_SPEC.get(chosen_crop, None)
    if crop_spec is None:
        crop_spec = {'pH': (6.0, 7.0), 'EC': 2.0, 'temp': (15, 30), 'moisture': (40, 70), 'N': 70, 'P': 40, 'K': 40}

    # EC
    ec_score = min(1.0, max(0.0, (sensor.ec / 5.0)))
    score += ec_score * w['EC'] * 100
    if sensor.ec > crop_spec['EC'] + 0.5:
        reasons.append("High soil salinity compared with crop ideal range")
        precautions.append("Apply gypsum or leach salts with good irrigation water")

    # pH
    ideal_low, ideal_high = crop_spec['pH']
    ph_dist = 0.0
    if sensor.ph < ideal_low:
        ph_dist = (ideal_low - sensor.ph) / 3
    elif sensor.ph > ideal_high:
        ph_dist = (sensor.ph - ideal_high) / 3
    ph_score = min(1.0, max(0.0, ph_dist))
    score += ph_score * w['pH'] * 100
    if ph_score > 0.1:
        reasons.append("Soil pH is outside the crop preferred range")
        precautions.append("Use lime for acidic soil or sulfur for alkaline soil")

    # NPK distance
    npk_error = abs(sensor.n - crop_spec['N']) / crop_spec['N']
    npk_error += abs(sensor.p - crop_spec['P']) / crop_spec['P']
    npk_error += abs(sensor.k - crop_spec['K']) / crop_spec['K']
    npk_score = min(1.0, npk_error / 2.5)
    score += npk_score * w['NPK'] * 100
    if npk_score > 0.3:
        reasons.append("NPK percentages are not closely aligned with crop nutrient profile")
        precautions.append("Apply recommended fertilizer mix based on soil test")

    # Temp
    min_temp, max_temp = crop_spec['temp']
    temp_score = 0.0
    if sensor.temp < min_temp:
        temp_score = (min_temp - sensor.temp) / 15
    elif sensor.temp > max_temp:
        temp_score = (sensor.temp - max_temp) / 15
    temp_score = min(1.0, temp_score)
    score += temp_score * w['Temp'] * 100
    if temp_score > 0.2:
        reasons.append("Temperature is stressful for crop growth")
        precautions.append("Consider shade nets, mulching, or crop calendar adjustment")

    # Moisture
    min_m, max_m = crop_spec['moisture']
    moist_score = 0.0
    if sensor.moisture < min_m:
        moist_score = (min_m - sensor.moisture) / 50
    elif sensor.moisture > max_m:
        moist_score = (sensor.moisture - max_m) / 50
    moist_score = min(1.0, moist_score)
    score += moist_score * w['Moisture'] * 100
    if moist_score > 0.2:
        reasons.append("Moisture level is not optimal")
        precautions.append("Use drip irrigation and mulching for water management")

    # Rainfall
    rain_history = sensor.rainfall_history if sensor.rainfall_history is not None else 1.0
    rain_score = 0.0
    if rain_history < 300:
        rain_score = 1.0
        reasons.append("Low historical rainfall at location")
        precautions.append("Plan supplemental irrigation and water harvesting")
    elif rain_history < 600:
        rain_score = 0.4
    score += rain_score * w['Rainfall'] * 100

    total_score = min(100.0, max(0.0, score))
    return total_score, reasons, precautions


@app.post("/api/predict", response_model=PredictionResponse)
async def predict(farm_user: FarmUser, sensor: SensorInput):
    # 1. weather lookup
    weather_current = "Unknown"
    api_key = os.getenv('OPENWEATHER_API_KEY', '').strip()
    if api_key:
        try:
            r = requests.get(
                f"https://api.openweathermap.org/data/2.5/weather?lat={sensor.lat}&lon={sensor.lon}&appid={api_key}&units=metric",
                timeout=8,
            )
            rj = r.json()
            weather_current = rj.get('weather', [{}])[0].get('description', 'Unknown')
            sensor.rainfall_history = sensor.rainfall_history or rj.get('rain', {}).get('1h', 0)
        except Exception:
            weather_current = 'API call failed'

    # 2. AI crop scoring
    features = np.array([[sensor.n, sensor.p, sensor.k, sensor.ph, sensor.ec, sensor.temp, sensor.moisture, sensor.rainfall_history or 0.0]])
    probs = model.predict_proba(features)[0]
    ordered = sorted(zip(model.classes_, probs), key=lambda x: x[1], reverse=True)
    top_crops = [c for c, p in ordered[:5]]
    probabilities = [round(float(p * 100), 2) for _, p in ordered[:5]]
    recommended = top_crops[0]

    # 3. risk analysis
    risk_score, reasons, precautions = risk_eval(sensor, recommended)
    if risk_score <= 30:
        risk_level = 'Low'
        insurance = 'Basic Revenue Protection'
    elif risk_score <= 70:
        risk_level = 'Moderate'
        insurance = 'Yield Protection + Weather Index'
    else:
        risk_level = 'High'
        insurance = 'High Premium + Catastrophic coverage'

    payload = {
        'top_crops': top_crops,
        'probabilities': probabilities,
        'recommended': recommended,
        'risk_score': round(risk_score, 1),
        'risk_level': risk_level,
        'insurance': insurance,
        'reasons': reasons,
        'precautions': precautions,
        'weather_current': weather_current,
        'previous_analyses': history[-5:],
    }

    record = {
        'user': farm_user.name,
        'location': f"{farm_user.district}, {farm_user.state}, {farm_user.pin_code}",
        'sensor': sensor.dict(),
        'recommended': recommended,
        'risk_score': payload['risk_score'],
        'risk_level': risk_level,
    }
    history.append(record)

    return payload

@app.post("/api/keywords")
async def index_data():
    # placeholder endpoint that could be used for DB insertion in real app
    return {"status": "ingested"}

@app.get("/api/history")
async def get_history():
    return history[-10:]
