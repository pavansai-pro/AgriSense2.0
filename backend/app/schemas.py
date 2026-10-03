from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Language = Literal["en", "hi", "te", "ta", "mr"]


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(pattern=r"^\+?\d{10,13}$")
    pin: str = Field(pattern=r"^\d{4,6}$", description="4-6 digit PIN, easy to speak")
    email: EmailStr | None = None
    state: str | None = None
    district: str | None = None
    pin_code: str | None = Field(default=None, pattern=r"^\d{6}$")
    acres: float | None = Field(default=None, ge=0)
    current_crop: str | None = None
    language: Language = "en"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str | None
    email: str | None
    state: str | None
    district: str | None
    pin_code: str | None
    acres: float | None
    current_crop: str | None
    language: str
    theme: str


class UserUpdate(BaseModel):
    name: str | None = None
    state: str | None = None
    district: str | None = None
    pin_code: str | None = Field(default=None, pattern=r"^\d{6}$")
    acres: float | None = Field(default=None, ge=0)
    current_crop: str | None = None
    language: Language | None = None
    theme: Literal["light", "dark"] | None = None


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshIn(BaseModel):
    refresh_token: str


class SoilIn(BaseModel):
    n: float = Field(ge=0, le=300, description="Nitrogen")
    p: float = Field(ge=0, le=300, description="Phosphorus")
    k: float = Field(ge=0, le=300, description="Potassium")
    moisture: float = Field(ge=0, le=100, description="Soil moisture %")
    temperature: float = Field(ge=-10, le=60, description="Soil temperature °C")
    ph: float = Field(ge=0, le=14)


class CropPredictIn(SoilIn):
    state: str | None = None
    sowing_date: date | None = None
    client_id: str | None = None


class RiskIn(SoilIn):
    crop: str
    state: str | None = None
    district: str | None = None
    lat: float | None = None
    lon: float | None = None
    sowing_date: date | None = None
    planned_harvest: date | None = None
    lang: Language = "en"


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    lang: Language = "en"
    session_id: str | None = None
    context: dict[str, Any] | None = None


class SyncRecord(BaseModel):
    client_id: str = Field(min_length=1, max_length=64)
    kind: Literal["soil_reading", "harvest_record"]
    payload: dict[str, Any]
    updated_at: datetime
    deleted: bool = False


class SyncPushIn(BaseModel):
    device_id: str | None = None
    records: list[SyncRecord] = Field(max_length=500)


class VoiceLogIn(BaseModel):
    transcript: str = Field(max_length=500)
    lang: str
    intent: str | None = None
    matched: bool = False
    confidence: float | None = None
    route: str | None = None
