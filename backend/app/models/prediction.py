"""
NeuralText — Prediction & BatchJob Models
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class Prediction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "predictions"

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ml_models.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Raw input
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Full result payload
    result: Mapped[dict] = mapped_column(JSON, nullable=False)
    # e.g. {prediction: "positive", confidence: 0.984, probabilities: {...}, latency_ms: 38}

    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Human feedback: correct | incorrect | unsure | null
    feedback: Mapped[str | None] = mapped_column(String(50), nullable=True)
    feedback_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Explainability data (optional, can be large)
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Source: playground | api | batch
    source: Mapped[str] = mapped_column(String(50), default="api", nullable=False)

    # Relationships
    model: Mapped["MLModel"] = relationship(back_populates="predictions")


class BatchJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "batch_jobs"

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ml_models.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Input file path in object storage
    input_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Output file path in object storage
    output_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Column containing text to classify
    text_column: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status: pending | queued | running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Progress
    total_records: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    processed_records: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    failed_records: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    model: Mapped["MLModel"] = relationship(back_populates="batch_jobs")
