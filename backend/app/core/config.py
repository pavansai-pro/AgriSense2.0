import logging
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AgriSense API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://agrisense:agrisense@localhost:5432/agrisense"
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db: str = "agrisense"

    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    refresh_token_days: int = 14

    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    google_client_id: str | None = None
    google_client_secret: str | None = None
    oauth_redirect_base: str = "http://localhost:8000"

    openweather_api_key: str | None = None
    weather_cache_minutes: int = 180

    llm_api_key: str | None = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    ml_artifacts_dir: Path = REPO_ROOT / "ml" / "artifacts"
    ml_data_dir: Path = REPO_ROOT / "ml" / "data" / "raw"

    @model_validator(mode="after")
    def _require_jwt_secret(self) -> "Settings":
        weak = len(self.jwt_secret) < 16 or self.jwt_secret.startswith("change-me")
        if weak and self.environment != "development":
            raise ValueError("JWT_SECRET must be set to a random value of at least 16 characters")
        if weak:
            # Dev only: a per-process random key, so tokens can't be forged from a published default.
            logging.getLogger(__name__).warning("JWT_SECRET unset or weak; using a random per-process key")
            self.jwt_secret = secrets.token_urlsafe(48)
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
