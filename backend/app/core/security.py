"""
Authentication & authorization core.

- Passwords: PBKDF2-HMAC-SHA256, 390k iterations, per-user random salt,
  constant-time comparison (hashlib standard library; no native deps).
- Sessions: signed JWTs (PyJWT) with expiry; secret from settings.
- Login brute force: in-memory per-(IP, email) failure counter with lockout.
- RBAC: role dependency factory (procurement_officer < reviewer < admin).
"""

import hashlib
import hmac
import secrets
import time
from typing import Dict, List, Optional, Set

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.entities import User

PBKDF2_ITERATIONS = 390_000
_TOKEN_LEEWAY = 30  # seconds of clock-skew tolerance

ROLE_LEVELS: Dict[str, int] = {
    "procurement_officer": 1,
    "reviewer": 2,
    "admin": 3,
}


# ---------------------------------------------------------------- passwords

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


# ---------------------------------------------------------------- tokens

def create_access_token(user: User) -> str:
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "role": user.role,
        "name": user.name,
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            leeway=_TOKEN_LEEWAY,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session token.")
    return payload


# ---------------------------------------------------------------- login rate limiting

class LoginRateLimiter:
    """In-memory brute-force guard. Single-process demo grade: for multi-worker
    deployments back this with a shared store (documented in the README)."""

    def __init__(self, max_attempts: int, lockout_seconds: int):
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self._failures: Dict[str, List[float]] = {}

    @staticmethod
    def _key(request: Request, email: str) -> str:
        ip = request.client.host if request.client else "unknown"
        return f"{ip}|{email.strip().lower()}"

    def check_locked(self, request: Request, email: str) -> Optional[int]:
        """Returns remaining lockout seconds when locked, else None."""
        key = self._key(request, email)
        now = time.time()
        recent = [t for t in self._failures.get(key, []) if now - t < self.lockout_seconds]
        self._failures[key] = recent
        if len(recent) >= self.max_attempts:
            return int(self.lockout_seconds - (now - recent[0]))
        return None

    def record_failure(self, request: Request, email: str) -> None:
        key = self._key(request, email)
        self._failures.setdefault(key, []).append(time.time())

    def reset(self, request: Request, email: str) -> None:
        self._failures.pop(self._key(request, email), None)


login_rate_limiter = LoginRateLimiter(settings.LOGIN_MAX_ATTEMPTS, settings.LOGIN_LOCKOUT_SECONDS)


# ---------------------------------------------------------------- dependencies

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    user = db.query(User).filter(User.user_id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account no longer exists.")
    return user


def require_roles(*allowed_roles: str):
    """Dependency factory: allow only the listed roles (admin always allowed)."""
    allowed: Set[str] = set(allowed_roles) | {"admin"}

    def role_guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of the roles: {', '.join(sorted(allowed))}.",
            )
        return user

    return role_guard


def validate_role(role: str) -> str:
    if role not in ROLE_LEVELS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role '{role}'. Allowed: {', '.join(ROLE_LEVELS)}",
        )
    return role
