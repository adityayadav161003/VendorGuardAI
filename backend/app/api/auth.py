"""
Authentication API: register, login, session introspection.

- New registrations are always the least-privileged role (procurement_officer);
  role changes happen only through the admin endpoint.
- Login is rate-limited per (IP, email) to blunt credential stuffing, and
  failures return a uniform error so account existence is never revealed.
- The bootstrap admin is seeded once at startup from environment settings.
"""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    login_rate_limiter,
    validate_role,
    verify_password,
)
from app.models.entities import User
from app.services.audit import record_event

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_MIN_LENGTH = 8


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=PASSWORD_MIN_LENGTH, max_length=128)
    organization: Optional[str] = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=100)
    password: str = Field(..., max_length=128)


class UserResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    organization: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


def _validate_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Please provide a valid email address.")
    return email


def seed_admin_user(db: Session) -> None:
    """Idempotently ensures the bootstrap admin exists (called at startup)."""
    email = settings.ADMIN_EMAIL.strip().lower()
    if db.query(User).filter(User.email == email).first():
        return
    db.add(User(
        name=settings.ADMIN_NAME,
        email=email,
        role="admin",
        organization="VendorGuard",
        password_hash=hash_password(settings.ADMIN_PASSWORD),
    ))
    db.commit()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    email = _validate_email(payload.email)
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        name=payload.name.strip(),
        email=email,
        role="procurement_officer",
        organization=(payload.organization or "VendorGuard").strip()[:200],
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    record_event(db, "USER_REGISTERED", user.user_id, user_id=user.user_id, details={"role": user.role})
    db.commit()
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    locked_for = login_rate_limiter.check_locked(request, email)
    if locked_for is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {max(1, locked_for)} seconds.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        login_rate_limiter.record_failure(request, email)
        # Uniform error: never reveal whether the email exists
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    login_rate_limiter.reset(request, email)
    record_event(db, "USER_LOGIN", user.user_id, user_id=user.user_id)
    db.commit()
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
