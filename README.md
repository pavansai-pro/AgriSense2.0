# AgriSense 2.0

Voice-first, offline-capable farming assistant for Indian farmers: crop recommendations, 16-day weather, crop risk scores with prevention advice, and a RAG assistant — all controllable by voice in English, Hindi, Telugu, Tamil and Marathi.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architecture diagram, folder structure, ML details and roadmap.

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, Dexie (IndexedDB), Web Speech API, PWA service worker
- **Backend**: FastAPI, SQLAlchemy 2 + PostgreSQL, PyMongo + MongoDB, JWT + OAuth 2.0
- **ML**: scikit-learn, pandas — `ml/agrisense_ml`

## Run locally

Prerequisites: Docker, Python 3.10+, Node 22.

```bash
# 1. Databases
docker compose up -d postgres mongo

# 2. Backend
python -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements-dev.txt -e ml
cp backend/.env.example backend/.env        # set JWT_SECRET
python -m agrisense_ml.train                # builds ml/artifacts from ml/data/raw
cd backend && uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Or everything in containers: `cp backend/.env.example backend/.env && docker compose up --build`.

Optional keys in `backend/.env`: `OPENWEATHER_API_KEY` (otherwise Open-Meteo is used), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Google sign-in), `LLM_API_KEY` (generative answers; otherwise extractive).

Voice recognition needs Chrome/Edge (Web Speech API) and HTTPS or localhost.

## Tests

```bash
. .venv/bin/activate
ruff check backend ml
(cd backend && pytest -q)
(cd ml && pytest -q)
(cd frontend && npm run lint && npm run build)
```

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh` | phone + PIN accounts, OAuth2 password grant, JWT refresh |
| GET | `/api/auth/oauth/google/login` | Google OAuth 2.0 |
| GET/PATCH | `/api/auth/me` | profile, language, theme |
| POST | `/api/crops/predict` | crop recommendation, yield, harvest window |
| POST | `/api/risk/assess` | risk score 0-100, causes, prevention |
| GET | `/api/weather/forecast` | 16-day forecast by state/district/coords |
| POST | `/api/chat` | RAG assistant |
| POST/GET | `/api/sync/push`, `/api/sync/pull` | offline sync |
| POST | `/api/voice/logs` | voice interaction logs |
| GET | `/api/dashboard`, `/api/meta/locations`, `/api/health` | dashboard, states/districts, health |

## Deploy (free tiers)

| Part | Host | Config |
|---|---|---|
| FastAPI backend | Render (Docker, free) | `render.yaml` |
| Next.js frontend | Vercel (root directory `frontend`) | `BACKEND_URL` |
| PostgreSQL | Neon | `DATABASE_URL` |
| MongoDB | Atlas M0 (Network Access `0.0.0.0/0`) | `MONGO_URL` |

1. Render: New > Blueprint > this repo. Fill in `DATABASE_URL` (Neon string; `postgres://` is auto-converted to the psycopg driver), `MONGO_URL`, `FRONTEND_URL`/`CORS_ORIGINS` (the Vercel URL) and `OAUTH_REDIRECT_BASE` (the Render URL). `JWT_SECRET` is generated. Check `https://<render-url>/api/health`.
2. Vercel: import the repo with root directory `frontend` and set `BACKEND_URL=https://<render-url>`. The browser only talks to Vercel; `/api/*` is proxied to Render by `next.config.ts`.

Render's free plan sleeps after 15 minutes idle, so the first request after a pause takes about a minute.

## Data note

`sensor_Crop_Dataset (1).csv` has identical feature distributions for every crop; a RandomForest trained on it scores at chance (16.6% vs 16.7%). The recommender therefore weights that model at 0 and relies on agronomic ranges and the state agricultural census until better labelled data is supplied.
