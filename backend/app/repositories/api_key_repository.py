"""
NeuralText — ApiKey Repository
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey


class ApiKeyRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> ApiKey:
        key = ApiKey(**kwargs)
        self.db.add(key)
        await self.db.flush()
        await self.db.refresh(key)
        return key

    async def get_by_hash(self, key_hash: str) -> Optional[ApiKey]:
        result = await self.db.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
        )
        return result.scalar_one_or_none()

    async def get_by_user(self, user_id: uuid.UUID) -> list[ApiKey]:
        result = await self.db.execute(
            select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.is_active == True)
        )
        return list(result.scalars().all())

    async def update_last_used(self, key_id: uuid.UUID) -> None:
        result = await self.db.execute(select(ApiKey).where(ApiKey.id == key_id))
        key = result.scalar_one_or_none()
        if key:
            key.last_used_at = datetime.now(timezone.utc)
            await self.db.flush()

    async def revoke(self, key_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
        )
        key = result.scalar_one_or_none()
        if key:
            key.is_active = False
            await self.db.flush()
            return True
        return False
