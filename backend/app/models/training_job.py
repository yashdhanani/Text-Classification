"""
NeuralText — TrainingJob & Experiment Models
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class TrainingJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "training_jobs"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    dataset_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("dataset_versions.id", ondelete="SET NULL"), nullable=True
    )
    # Job metadata
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_architecture: Mapped[str] = mapped_column(String(100), nullable=False)
    # config: full hyperparameter JSON
    config: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Status: pending | queued | running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Progress tracking
    current_epoch: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_epochs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Training log (per-epoch metrics)
    training_log: Mapped[list | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Hardware info
    hardware_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="training_jobs")
    dataset_version: Mapped["DatasetVersion | None"] = relationship(back_populates="training_jobs")
    experiments: Mapped[list["Experiment"]] = relationship(back_populates="training_job")
    ml_model: Mapped["MLModel | None"] = relationship(back_populates="training_job", uselist=False)


class Experiment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "experiments"

    training_job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("training_jobs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Full hyperparameter snapshot
    hyperparameters: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Best epoch metrics
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # e.g. {accuracy: 0.94, f1: 0.93, precision: 0.94, recall: 0.93, ...}

    # Per-class report
    classification_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Reproducibility
    random_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    training_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Status: running | completed | failed
    status: Mapped[str] = mapped_column(String(50), default="running", nullable=False)

    # Relationships
    training_job: Mapped["TrainingJob"] = relationship(back_populates="experiments")
