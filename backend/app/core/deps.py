"""
NeuralText — FastAPI Dependencies
Reusable dependency injection for auth, DB, Redis, and RBAC.
"""
from __future__ import annotations

import uuid
from typing import Annotated, Optional

import redis.asyncio as aioredis
from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import (
    AuthenticationError,
    InvalidTokenError,
    PermissionDeniedError,
    RateLimitError,
)
from app.core.security import decode_token, hash_api_key

bearer_scheme = HTTPBearer(auto_error=False)

# ── Redis pool (module-level singleton) ───────────────────────────────────────
_redis_pool: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_pool


# ── Current user extraction ───────────────────────────────────────────────────
async def get_current_user_id(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Security(bearer_scheme)
    ] = None,
    x_api_key: Annotated[Optional[str], Header()] = None,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> str:
    """
    Extract and validate the current user from JWT bearer token OR API key.
    Returns the user_id string.
    """
    from app.repositories.user_repository import UserRepository
    from app.repositories.api_key_repository import ApiKeyRepository

    # ── JWT path ─────────────────────────────────────────────────────────────
    if credentials:
        token_str = credentials.credentials
        if not token_str.startswith("nt_"):
            try:
                payload = decode_token(token_str)
                if payload.get("type") == "access":
                    user_id = payload.get("sub")
                    if user_id:
                        try:
                            jti = payload.get("jti", "")
                            if jti and await redis.exists(f"blocklist:{jti}"):
                                raise InvalidTokenError("Token has been revoked.")
                        except Exception:
                            pass
                        return user_id
            except Exception as e:
                pass
        else:
            x_api_key = token_str

    # ── API key path ──────────────────────────────────────────────────────────
    if x_api_key:
        key_repo = ApiKeyRepository(db)
        hashed = hash_api_key(x_api_key)
        api_key = await key_repo.get_by_hash(hashed)
        if not api_key or not api_key.is_active:
            raise InvalidTokenError("Invalid or revoked API key.")

        # Rate limiting per API key
        rate_key = f"rate:{api_key.id}"
        current = await redis.incr(rate_key)
        if current == 1:
            await redis.expire(rate_key, 60)
        if current > api_key.rate_limit_per_minute:
            raise RateLimitError("API key rate limit exceeded.")

        # Update last_used
        await key_repo.update_last_used(api_key.id)
        return str(api_key.user_id)

    raise AuthenticationError("No valid authentication credentials provided.")


async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the full User ORM object for the authenticated user."""
    from app.repositories.user_repository import UserRepository

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(uuid.UUID(user_id))
    if not user:
        raise AuthenticationError("User not found.")
    if not user.is_active:
        raise PermissionDeniedError("Account is deactivated.")
    return user


# ── RBAC helpers ──────────────────────────────────────────────────────────────
def require_roles(*roles: str):
    """Dependency factory that enforces one of the given roles."""

    async def _check(user=Depends(get_current_user)):
        if user.role not in roles:
            raise PermissionDeniedError(
                f"Role '{user.role}' is not authorized for this action."
            )
        return user

    return _check


require_admin = require_roles("admin")
require_ml_engineer = require_roles("admin", "ml_engineer")
require_analyst = require_roles("admin", "ml_engineer", "analyst")


# ── Pagination ────────────────────────────────────────────────────────────────
class PaginationParams:
    def __init__(self, page: int = 1, per_page: int = 20):
        self.page = max(1, page)
        self.per_page = min(max(1, per_page), 100)
        self.offset = (self.page - 1) * self.per_page
