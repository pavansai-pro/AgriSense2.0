from functools import lru_cache

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.core.config import get_settings


@lru_cache
def get_client() -> MongoClient:
    url = get_settings().mongo_url
    if url.startswith("mongomock://"):
        import mongomock

        return mongomock.MongoClient()
    return MongoClient(url, serverSelectionTimeoutMS=3000, tz_aware=True)


def get_mongo() -> Database:
    return get_client()[get_settings().mongo_db]


def init_mongo() -> None:
    db = get_mongo()
    db.predictions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.risk_assessments.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.chat_history.create_index([("user_id", ASCENDING), ("session_id", ASCENDING), ("created_at", ASCENDING)])
    db.voice_logs.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.sensor_readings.create_index([("user_id", ASCENDING), ("client_id", ASCENDING)], unique=True)
    db.sensor_readings.create_index([("user_id", ASCENDING), ("server_updated_at", ASCENDING)])
