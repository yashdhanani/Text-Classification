"""
NeuralText — ApiKey, AuditLog, UsageMetrics Models
"""
from __future__ import annotations

import uuid
from datetime import datetime, date

from sqlalchemy import BigInteger, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class ApiKey(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "api_keys"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Only the SHA-256 hash is stored
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    # Prefix shown to user for identification (e.g., "nt_abc...")
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False)

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="api_keys")


class AuditLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "model.deploy"
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Relationships
    user: Mapped["User | None"] = relationship(back_populates="audit_logs")


class UsageMetrics(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "usage_metrics"

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ml_models.id", ondelete="CASCADE"), index=True, nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    prediction_count: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    avg_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Class distribution counts
    class_distribution: Mapped[dict | None] = mapped_column(JSON, nullable=True)
