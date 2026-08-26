"""
NeuralText — Security Utilities
JWT token creation/verification, password hashing, API key management.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _hasher.verify(hashed_password, plain_password)
    except Exception:
        return False


# ── JWT Tokens ───────────────────────────────────────────────────────────────
def create_access_token(
    subject: str | Any,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str | Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def create_password_reset_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES
    )
    payload = {
        "sub": email,
        "exp": expire,
        "type": "password_reset",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_password_reset_token(token: str) -> Optional[str]:
    try:
        payload = decode_token(token)
        if payload.get("type") != "password_reset":
            return None
        return payload["sub"]
    except JWTError:
        return None


# ── API Keys ─────────────────────────────────────────────────────────────────
def generate_api_key() -> tuple[str, str]:
    """
    Generate a new API key.
    Returns (raw_key, hashed_key).
    Only the hashed key is stored in the database.
    """
    raw_key = f"nt_live_{secrets.token_urlsafe(32)}"
    hashed_key = hash_api_key(raw_key)
    return raw_key, hashed_key


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def verify_api_key(raw_key: str, hashed_key: str) -> bool:
    return hash_api_key(raw_key) == hashed_key
