"""
NeuralText — Database Engine & Session Factory
Async SQLAlchemy setup with connection pooling.
"""
from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy import DateTime, func, create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import uuid
from datetime import datetime

from app.core.config import settings


_raw_url = str(settings.DATABASE_URL)
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql://", 1)

if _raw_url.startswith("postgresql://") and not _raw_url.startswith("postgresql+"):
    _async_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    _async_url = _raw_url

if _async_url.startswith("postgresql+asyncpg://"):
    _sync_url = _async_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
else:
    _sync_url = _async_url

engine = create_async_engine(
    _async_url,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ── Synchronous engine (for Celery workers / threads) ─────────────────────────
sync_engine = create_engine(
    _sync_url,
    pool_size=3,
    max_overflow=2,
    pool_pre_ping=True,
)
SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_all_tables() -> None:
    """Create all tables (used in development/testing only — production uses Alembic)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_all_tables() -> None:
    """Drop all tables (testing only)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
