"""
NeuralText — User Model
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Role: admin | ml_engineer | analyst | user
    role: Mapped[str] = mapped_column(String(50), default="user", nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    projects: Mapped[list["Project"]] = relationship(back_populates="owner", lazy="selectin")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="user", lazy="selectin")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")

    def __repr__(self) -> str:
        return f"<User {self.email!r} role={self.role!r}>"
