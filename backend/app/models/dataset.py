"""
NeuralText — Dataset & DatasetVersion Models
"""
from __future__ import annotations

import uuid

from sqlalchemy import BigInteger, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Dataset(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "datasets"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    file_format: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Schema info: {columns: [...], dtypes: {...}}
    schema_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Status: uploading | processing | ready | error
    status: Mapped[str] = mapped_column(String(50), default="uploading", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="datasets")
    versions: Mapped[list["DatasetVersion"]] = relationship(
        back_populates="dataset", order_by="DatasetVersion.created_at.desc()"
    )


class DatasetVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "dataset_versions"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Column mapping
    text_column: Mapped[str | None] = mapped_column(String(255), nullable=True)
    label_column: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Split configuration
    split_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # e.g. {"train": 0.7, "val": 0.15, "test": 0.15, "stratified": true, "seed": 42}

    # Paths in object storage
    train_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    val_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    test_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Statistics
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # e.g. {total: 10000, train: 7000, val: 1500, test: 1500, classes: [...], distribution: {...}}

    # Relationships
    dataset: Mapped["Dataset"] = relationship(back_populates="versions")
    training_jobs: Mapped[list["TrainingJob"]] = relationship(back_populates="dataset_version")
