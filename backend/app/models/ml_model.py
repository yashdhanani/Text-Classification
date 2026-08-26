"""
NeuralText — MLModel, ModelVersion, Deployment Models
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class MLModel(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ml_models"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    training_job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("training_jobs.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Architecture metadata
    architecture: Mapped[str] = mapped_column(String(100), nullable=False)
    # framework: pytorch | huggingface
    framework: Mapped[str] = mapped_column(String(50), default="pytorch", nullable=False)
    # task_type: sentiment | classification | multi_label
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Label mapping stored as JSON: {"0": "negative", "1": "positive"}
    label_map: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    num_classes: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    # Status: training | ready | failed | archived
    status: Mapped[str] = mapped_column(String(50), default="training", nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="ml_models")
    training_job: Mapped["TrainingJob | None"] = relationship(back_populates="ml_model")
    versions: Mapped[list["ModelVersion"]] = relationship(
        back_populates="model", order_by="ModelVersion.version.desc()"
    )
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="model")
    batch_jobs: Mapped[list["BatchJob"]] = relationship(back_populates="model")


class ModelVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "model_versions"

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ml_models.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Object storage path for the artifact
    artifact_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Full training config snapshot
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Best metrics from evaluation
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    classification_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Confusion matrix data
    confusion_matrix: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Status: staging | production | archived | shadow
    stage: Mapped[str] = mapped_column(String(50), default="staging", nullable=False)

    # Relationships
    model: Mapped["MLModel"] = relationship(back_populates="versions")
    deployment: Mapped["Deployment | None"] = relationship(
        back_populates="model_version", uselist=False
    )


class Deployment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "deployments"

    model_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("model_versions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # stage: staging | production
    stage: Mapped[str] = mapped_column(String(50), nullable=False)
    deployed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deployed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    # Endpoint info
    endpoint_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Relationships
    model_version: Mapped["ModelVersion"] = relationship(back_populates="deployment")
