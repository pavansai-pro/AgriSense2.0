import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.mongo import init_mongo
from app.db.postgres import init_db
from app.routers import auth, chat, crops, dashboard, meta, risk, sync, voice, weather
from app.services.ml import get_recommender
from app.services.rag import get_kb

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    init_mongo()
    get_recommender()
    get_kb()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (auth, weather, crops, risk, chat, sync, voice, dashboard, meta):
    app.include_router(r.router)
