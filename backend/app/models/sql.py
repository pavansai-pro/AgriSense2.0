from datetime import date, datetime, timezone

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    pin_hash: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(80))
    district: Mapped[str | None] = mapped_column(String(80))
    pin_code: Mapped[str | None] = mapped_column(String(10))
    acres: Mapped[float | None] = mapped_column(Float)
    current_crop: Mapped[str | None] = mapped_column(String(60))
    language: Mapped[str] = mapped_column(String(8), default="en")
    theme: Mapped[str] = mapped_column(String(8), default="light")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30))
    subject: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    scopes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="oauth_accounts")


class HarvestRecord(Base):
    __tablename__ = "harvest_records"
    __table_args__ = (UniqueConstraint("user_id", "client_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[str] = mapped_column(String(64))
    crop: Mapped[str] = mapped_column(String(60))
    variety: Mapped[str | None] = mapped_column(String(80))
    area_acres: Mapped[float | None] = mapped_column(Float)
    sowing_date: Mapped[date | None] = mapped_column(Date)
    expected_harvest: Mapped[date | None] = mapped_column(Date)
    actual_harvest: Mapped[date | None] = mapped_column(Date)
    yield_quintals: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(String(1000))
    deleted: Mapped[bool] = mapped_column(default=False)
    client_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    server_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class WeatherCache(Base):
    __tablename__ = "weather_cache"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    provider: Mapped[str] = mapped_column(String(30))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    payload: Mapped[dict] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
