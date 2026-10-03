from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings


def hash_secret(secret: str) -> str:
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()


def verify_secret(secret: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(secret.encode(), hashed.encode())


def create_token(user_id: int, kind: str = "access") -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    ttl = timedelta(minutes=s.access_token_minutes) if kind == "access" else timedelta(days=s.refresh_token_days)
    payload = {"sub": str(user_id), "type": kind, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str, kind: str = "access") -> int:
    s = get_settings()
    payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    if payload.get("type") != kind:
        raise jwt.InvalidTokenError("wrong token type")
    return int(payload["sub"])
