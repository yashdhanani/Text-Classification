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


engine = create_async_engine(
    settings.DATABASE_URL,
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
_sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")
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
