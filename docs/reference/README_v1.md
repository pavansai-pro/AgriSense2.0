# AgriSense Crop Prediction App

## Features implemented
- Login flow with required info (name, email, phone, location, pin, acres, crop)
- Permissions request for notifications + microphone
- Dashboard: crop prediction, risk analysis, weather forecast
- ML model: Random Forest with synthetic crop dataset and top-5 prediction
- Risk engine: weighted linear combination (NPK, pH, EC, temp, moisture, rainfall)
- Insurance recommendation: low/moderate/high with mapping
- Reason + precaution output
- Previous analysis history stored in `localStorage`
- Basic multilingual support (English, Hindi)
- Static route serving `app.html`

## Files
- `app.html` – frontend UI
- `server.py` – FastAPI backend API + ML + risk logic
- `requirements.txt` – dependencies
- `crop_dataset.csv` – sample historical dataset

## Setup
1. Set up Python env:
   - `python -m venv venv`
   - `venv\Scripts\activate`
2. Install deps:
   - `pip install -r requirements.txt`
3. Set OpenWeather API key (optional):
   - `set OPENWEATHER_API_KEY=your_key` (PowerShell) or `setx OPENWEATHER_API_KEY "your_key"`
4. Run server:
   - `uvicorn server:app --reload --host 0.0.0.0 --port 8000`
5. Open frontend:
   - `http://localhost:8000/app.html` (or root path served static)

## API endpoint
- `POST /api/predict` with JSON
  - `farm_user`: user data
  - `sensor`: sensor values

## Notes
- Change `YOUR_OPENWEATHER_API_KEY` in `app.html` or use env var to fetch live weather.
- The ESP32 sample code in your prompt should post to `/api/predict` with JSON sensor data.
- For production, add database persistence (PostgreSQL/Mongo) and secure authentication.
