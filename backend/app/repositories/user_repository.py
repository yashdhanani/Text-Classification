"""
NeuralText — User Repository
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_all(self, offset: int = 0, limit: int = 20) -> list[User]:
        result = await self.db.execute(select(User).offset(offset).limit(limit))
        return list(result.scalars().all())

    async def update(self, user: User, **kwargs) -> User:
        for key, val in kwargs.items():
            setattr(user, key, val)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def count(self) -> int:
        from sqlalchemy import func
        result = await self.db.execute(select(func.count()).select_from(User))
        return result.scalar_one()
