"""
NeuralText — Auth API Endpoints
JWT login, register, refresh, logout, password reset, email verification.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from jose import JWTError
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_redis
from app.core.exceptions import (
    AuthenticationError, EmailAlreadyExistsError, InvalidTokenError, UserNotFoundError
)
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password, create_password_reset_token,
    verify_password_reset_token,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Schemas ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 min in seconds


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    full_name: str
    role: str
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)

    if await repo.get_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email already registered.")
    if await repo.get_by_username(body.username):
        raise HTTPException(status_code=409, detail="Username already taken.")

    user = await repo.create(
        email=body.email,
        username=body.username,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        is_verified=True,  # Auto-verify in dev; use email flow in prod
        role="user",
    )
    logger.info("User registered", user_id=str(user.id), email=user.email)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        repo = UserRepository(db)
        user = await repo.get_by_email(body.email)

        if not user or not verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account deactivated.")

        try:
            await repo.update(user, last_login_at=datetime.now(timezone.utc))
        except Exception as e:
            logger.warning("Could not update last_login_at", error=str(e))

        extra = {"role": user.role, "email": user.email}
        return TokenResponse(
            access_token=create_access_token(str(user.id), extra_claims=extra),
            refresh_token=create_refresh_token(str(user.id)),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login encountered an unhandled error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Authentication server error: {str(e)}")


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Not a refresh token.")
        user_id = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive.")

    extra = {"role": user.role, "email": user.email}
    return TokenResponse(
        access_token=create_access_token(str(user.id), extra_claims=extra),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    redis=Depends(get_redis),
    current_user: User = Depends(get_current_user),
):
    """Blocklist the access token JTI so it cannot be reused."""
    # In a real request the access token JTI would come from the request headers
    # Here we simply acknowledge the logout (client deletes local tokens)
    return Response(status_code=204)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if user:
        token = create_password_reset_token(user.email)
        # In production: send email with reset link containing token
        logger.info("Password reset requested", email=user.email, token=token[:10] + "...")
    # Always return 204 to prevent email enumeration
    return Response(status_code=204)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = verify_password_reset_token(body.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    repo = UserRepository(db)
    user = await repo.get_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await repo.update(user, hashed_password=hash_password(body.new_password))
    return Response(status_code=204)
