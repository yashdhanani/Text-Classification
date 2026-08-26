"""
NeuralText — Project Model
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Project(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # task_type: sentiment | classification | multi_label
    task_type: Mapped[str] = mapped_column(String(50), default="classification", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="projects")
    datasets: Mapped[list["Dataset"]] = relationship(back_populates="project")
    training_jobs: Mapped[list["TrainingJob"]] = relationship(back_populates="project")
    ml_models: Mapped[list["MLModel"]] = relationship(back_populates="project")

    def __repr__(self) -> str:
        return f"<Project {self.name!r}>"
