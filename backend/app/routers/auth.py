import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_token, decode_token, hash_secret, verify_secret
from app.db.postgres import get_db
from app.deps import get_current_user
from app.models.sql import OAuthAccount, User
from app.schemas import RefreshIn, RegisterIn, TokenOut, UserOut, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"
OAUTH_SCOPES = "openid email profile"


def _tokens(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
        user=UserOut.model_validate(user),
    )


def _normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)) -> TokenOut:
    phone = _normalize_phone(body.phone)
    clauses = [User.phone == phone] + ([User.email == body.email] if body.email else [])
    if db.scalar(select(User).where(or_(*clauses))):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this phone or email already exists")
    user = User(
        **body.model_dump(exclude={"pin", "phone"}),
        phone=phone,
        pin_hash=hash_secret(body.pin),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _tokens(user)


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> TokenOut:
    """OAuth 2.0 password grant: username = phone or email, password = PIN."""
    ident = form.username.strip()
    where = User.email == ident.lower() if "@" in ident else User.phone == _normalize_phone(ident)
    user = db.scalar(select(User).where(where))
    if not user or not verify_secret(form.password, user.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong phone number or PIN")
    return _tokens(user)


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)) -> TokenOut:
    try:
        user_id = decode_token(body.refresh_token, "refresh")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from None
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return _tokens(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.get("/providers")
def providers() -> dict:
    s = get_settings()
    return {"google": bool(s.google_client_id and s.google_client_secret)}


@router.get("/oauth/google/login")
def google_login(request: Request) -> RedirectResponse:
    s = get_settings()
    if not (s.google_client_id and s.google_client_secret):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Google sign-in is not configured")
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": f"{s.oauth_redirect_base}/api/auth/oauth/google/callback",
        "response_type": "code",
        "scope": OAUTH_SCOPES,
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    resp = RedirectResponse(f"{GOOGLE_AUTH}?{urlencode(params)}")
    resp.set_cookie("oauth_state", state, max_age=600, httponly=True, samesite="lax")
    return resp


@router.get("/oauth/google/callback")
def google_callback(code: str, state: str, request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    s = get_settings()
    if not state or state != request.cookies.get("oauth_state"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "OAuth state mismatch")
    try:
        tok = httpx.post(
            GOOGLE_TOKEN,
            data={
                "code": code,
                "client_id": s.google_client_id,
                "client_secret": s.google_client_secret,
                "redirect_uri": f"{s.oauth_redirect_base}/api/auth/oauth/google/callback",
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        tok.raise_for_status()
        info = httpx.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {tok.json()['access_token']}"}, timeout=10)
        info.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Google sign-in failed") from None
    profile = info.json()

    account = db.scalar(
        select(OAuthAccount).where(OAuthAccount.provider == "google", OAuthAccount.subject == profile["sub"])
    )
    if account:
        user = account.user
        account.last_login_at = datetime.now(timezone.utc)
    else:
        email = (profile.get("email") or "").lower() or None
        user = db.scalar(select(User).where(User.email == email)) if email else None
        if not user:
            user = User(name=profile.get("name") or "Farmer", email=email)
            db.add(user)
            db.flush()
        db.add(
            OAuthAccount(user_id=user.id, provider="google", subject=profile["sub"], email=email, scopes=OAUTH_SCOPES)
        )
    db.commit()
    t = _tokens(user)
    # Tokens travel in the URL fragment so they never reach server logs.
    resp = RedirectResponse(
        f"{s.frontend_url}/auth/callback#access_token={t.access_token}&refresh_token={t.refresh_token}"
    )
    resp.delete_cookie("oauth_state")
    return resp
