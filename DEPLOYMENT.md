# AgriSense 2.0 Production Deployment Guide

A complete walkthrough for deploying AgriSense 2.0 to production using Render (backend), Vercel (frontend), Neon (PostgreSQL), and MongoDB Atlas (MongoDB).

---

## 📋 Pre-Deployment Checklist

- [ ] GitHub repo is public or authorized for deployment
- [ ] All code is committed and pushed to `main`
- [ ] CI/CD pipeline passes (GitHub Actions)
- [ ] Local tests pass: `pytest -q` (backend) and `npm run build` (frontend)
- [ ] `.env` file is NOT committed
- [ ] You have accounts ready: Render, Vercel, Neon, MongoDB Atlas, Google Cloud (optional)

---

## 1️⃣ Set Up External Databases

### PostgreSQL (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project: `AgriSense`
3. Copy the connection string: `postgresql://user:password@host/dbname`
4. **Save this as `DATABASE_URL`** (Render will auto-convert `postgres://` to `postgresql+psycopg://`)

### MongoDB (MongoDB Atlas)

1. Go to [mongodb.com/cloud](https://www.mongodb.com/cloud/atlas) and sign up
2. Create a new cluster: M0 (free tier)
3. Set **Network Access** to `0.0.0.0/0` (or restrict to Render's IP)
4. Create a database user and password
5. Copy the connection string: `mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority`
6. **Save this as `MONGO_URL`**

---

## 2️⃣ Deploy Backend to Render

### Step 1: Connect Render to GitHub

1. Go to [render.com](https://render.com) and sign up
2. Click **New** → **Blueprint** (or paste repo URL directly)
3. Select this repository: `pavansai-pro/AgriSense2.0`
4. Render will auto-detect `render.yaml` and prompt for environment variables

### Step 2: Fill in Environment Variables

When Render prompts, provide these values:

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | Neon connection string | `postgresql://user:pass@ep-xxx.neon.tech/agrisense` |
| `MONGO_URL` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true` |
| `MONGO_DB` | Database name | `agrisense` |
| `FRONTEND_URL` | Vercel URL (deploy this AFTER frontend) | `https://agrisense-frontend.vercel.app` |
| `CORS_ORIGINS` | Same as `FRONTEND_URL` | `https://agrisense-frontend.vercel.app` |
| `OAUTH_REDIRECT_BASE` | Render backend URL (assigned after deploy) | `https://agrisense-api.onrender.com` |
| `OPENWEATHER_API_KEY` | (optional) Get from [openweathermap.org](https://openweathermap.org/api) | `your-api-key` |
| `GOOGLE_CLIENT_ID` | (optional) Get from Google Cloud Console | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | (optional) Google OAuth secret | `xxx` |
| `LLM_API_KEY` | (optional) OpenAI API key for chat | `sk-xxx` |

**Note:** Render generates `JWT_SECRET` automatically. Keep it.

### Step 3: Deploy

1. Click **Deploy** in Render
2. Wait for the build to complete (5-10 minutes)
3. Once live, note the URL: `https://agrisense-api-xxxxx.onrender.com`
4. Test the health endpoint: `curl https://agrisense-api-xxxxx.onrender.com/api/health`

Expected response:
```json
{
  "postgres": "ok",
  "mongo": "ok",
  "model": {"accuracy": 0.XX, "ml_weight": 0.XX}
}
```

---

## 3️⃣ Deploy Frontend to Vercel

### Step 1: Connect Vercel to GitHub

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click **Add New** → **Project** → **Import Git Repository**
3. Search and select `pavansai-pro/AgriSense2.0`
4. In the **Root Directory**, set to `frontend`

### Step 2: Set Environment Variables

Add this environment variable:

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | Your Render backend URL | `https://agrisense-api-xxxxx.onrender.com` |

### Step 3: Deploy

1. Click **Deploy**
2. Vercel will auto-run `npm run build` and start the frontend
3. Once live, note the URL: `https://agrisense-frontend.vercel.app`

### Step 4: Update Render CORS

Go back to Render → Settings → Environment Variables and update:
- `FRONTEND_URL` = `https://agrisense-frontend.vercel.app`
- `CORS_ORIGINS` = `https://agrisense-frontend.vercel.app`

Redeploy Render by pushing an empty commit:
```bash
git commit --allow-empty -m "Redeploy with frontend URL"
git push origin main
```

---

## 4️⃣ Configure Google OAuth (Optional)

If you want Google Sign-In:

### Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google+ API**
4. Create **OAuth 2.0 Credentials** (Web application)
5. Add authorized redirect URI:
   ```
   https://agrisense-api-xxxxx.onrender.com/api/auth/oauth/google/callback
   ```
6. Copy `Client ID` and `Client Secret`

### Set in Render

In Render → Environment Variables:
- `GOOGLE_CLIENT_ID` = `xxx.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET` = `xxx`

Redeploy Render.

---

## 5️⃣ Post-Deployment Validation

### Test Backend Health
```bash
curl https://agrisense-api-xxxxx.onrender.com/api/health
```

### Test Frontend Access
Open `https://agrisense-frontend.vercel.app` in a browser.

### Test API from Frontend
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try to register/login
4. Check that API requests go to your Render backend URL

### Test Database Connectivity
```bash
# Check if Postgres is accessible
curl -X GET https://agrisense-api-xxxxx.onrender.com/api/meta/locations

# Check if MongoDB is accessible (via the health endpoint)
curl https://agrisense-api-xxxxx.onrender.com/api/health
```

---

## 6️⃣ Monitoring & Logs

### Render Logs
1. Go to Render dashboard
2. Click the `agrisense-api` service
3. View real-time logs in the **Logs** tab

### Vercel Logs
1. Go to Vercel dashboard
2. Click the `AgriSense2.0` project
3. View build and runtime logs

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend returns 503 | Check Postgres/MongoDB in Render logs; verify `DATABASE_URL` and `MONGO_URL` |
| CORS errors | Verify `CORS_ORIGINS` matches Vercel URL exactly |
| OAuth redirect fails | Check redirect URI in Google Cloud Console and Render `OAUTH_REDIRECT_BASE` |
| 15-minute idle timeout | Render free tier sleeps after 15 min inactivity; first request takes ~1 min |

---

## 7️⃣ Continuous Deployment

### Auto-Deploy on Push

Both Render and Vercel are configured to auto-deploy when you push to `main`:

1. Make changes locally
2. Commit and push:
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   ```
3. GitHub Actions CI runs tests
4. On CI success, Render and Vercel auto-redeploy

### CI Checks Before Deploy

The GitHub Actions workflow (`.github/workflows/python-app.yml`) runs:
- Python lint & type checks (`ruff`)
- Backend tests (`pytest`)
- Frontend lint & build

If any step fails, deployment is blocked.

---

## 8️⃣ Production Environment Variables (Reference)

**File:** `backend/.env.production.example`

```dotenv
ENVIRONMENT=production

DATABASE_URL=postgresql+psycopg://user:pass@host/dbname
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true
MONGO_DB=agrisense

JWT_SECRET=<auto-generated by Render>
ACCESS_TOKEN_MINUTES=60
REFRESH_TOKEN_DAYS=14

FRONTEND_URL=https://agrisense-frontend.vercel.app
CORS_ORIGINS=https://agrisense-frontend.vercel.app

GOOGLE_CLIENT_ID=<your-oauth-id>
GOOGLE_CLIENT_SECRET=<your-oauth-secret>
OAUTH_REDIRECT_BASE=https://agrisense-api-xxxxx.onrender.com

OPENWEATHER_API_KEY=<optional>
WEATHER_CACHE_MINUTES=180

LLM_API_KEY=<optional OpenAI key>
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

---

## 9️⃣ Backup & Recovery

### PostgreSQL Backup (Neon)

Neon auto-backs up. To restore:
1. Go to Neon console
2. Select the project
3. Use point-in-time recovery (PITR)

### MongoDB Backup (Atlas)

1. Go to MongoDB Atlas dashboard
2. Click **Backup** → **Snapshots**
3. Click **Create** for manual backup
4. To restore, click **Restore** on the snapshot

---

## 🔟 Scaling Beyond Free Tier

When ready to scale:

- **Render**: Upgrade to paid plan ($10+/month) for better resources and guaranteed uptime
- **Vercel**: Stays free for most use cases; upgrade if you need advanced features
- **Neon**: Free tier includes 3GB storage; upgrade for more
- **MongoDB Atlas**: M0 (free) is limited; upgrade to M2+ ($57/month) for production use

---

## 📞 Support & Troubleshooting

- **Render docs**: [render.com/docs](https://render.com/docs)
- **Vercel docs**: [vercel.com/docs](https://vercel.com/docs)
- **Neon docs**: [neon.tech/docs](https://neon.tech/docs)
- **MongoDB docs**: [mongodb.com/docs](https://mongodb.com/docs)

---

**✅ Deployment Complete!**

Your AgriSense 2.0 app is now live. Share the frontend URL with farmers in India.
