"""
NeuralText — Admin API
Endpoints for platform administration (admin role only).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.training_job import TrainingJob
from app.models.ml_model import MLModel
from app.models.prediction import Prediction, BatchJob
from app.models.api_key import ApiKey
from app.core.logging import get_logger

logger = get_logger(__name__)
admin_router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Auth guard ────────────────────────────────────────────────────────────────

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserAdminView(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: Optional[str]
    is_active: bool
    created_at: Optional[datetime]
    projects: int = 0
    predictions: int = 0


class SystemStats(BaseModel):
    total_users: int
    active_users: int
    total_projects: int
    total_datasets: int
    total_models: int
    total_training_jobs: int
    total_predictions: int
    total_batch_jobs: int
    total_api_keys: int
    db_size_mb: float
    uptime_info: str


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@admin_router.get("/users", response_model=list[UserAdminView])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all platform users with basic stats."""
    stmt = select(User).order_by(User.created_at.desc()).limit(500)
    users = (await db.execute(stmt)).scalars().all()

    result = []
    for u in users:
        proj_count = (await db.execute(
            select(func.count()).select_from(Project).where(
                Project.owner_id == u.id, Project.deleted_at.is_(None)
            )
        )).scalar_one()

        pred_count = (await db.execute(
            select(func.count()).select_from(Prediction).where(
                Prediction.user_id == u.id
            )
        )).scalar_one()

        result.append(UserAdminView(
            id=str(u.id),
            email=u.email,
            full_name=getattr(u, "full_name", None),
            role=getattr(u, "role", "user"),
            is_active=getattr(u, "is_active", True),
            created_at=u.created_at,
            projects=proj_count,
            predictions=pred_count,
        ))

    return result


@admin_router.get("/users/{user_id}", response_model=UserAdminView)
async def get_user_detail(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    return UserAdminView(
        id=str(u.id),
        email=u.email,
        full_name=getattr(u, "full_name", None),
        role=getattr(u, "role", "user"),
        is_active=getattr(u, "is_active", True),
        created_at=u.created_at,
    )


@admin_router.patch("/users/{user_id}", response_model=UserAdminView)
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    if body.role is not None and hasattr(u, "role"):
        u.role = body.role
    if body.is_active is not None and hasattr(u, "is_active"):
        u.is_active = body.is_active
    if body.full_name is not None and hasattr(u, "full_name"):
        u.full_name = body.full_name
    await db.commit()
    await db.refresh(u)
    return UserAdminView(
        id=str(u.id),
        email=u.email,
        full_name=getattr(u, "full_name", None),
        role=getattr(u, "role", "user"),
        is_active=getattr(u, "is_active", True),
        created_at=u.created_at,
    )


@admin_router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Platform-wide statistics for the admin dashboard."""

    async def count(model, *filters):
        stmt = select(func.count()).select_from(model)
        for f in filters:
            stmt = stmt.where(f)
        return (await db.execute(stmt)).scalar_one()

    total_users      = await count(User)
    active_users     = await count(User, getattr(User, "is_active", True) == True)
    total_projects   = await count(Project, Project.deleted_at.is_(None))
    total_datasets   = await count(Dataset, Dataset.deleted_at.is_(None))
    total_models     = await count(MLModel, MLModel.deleted_at.is_(None))
    total_jobs       = await count(TrainingJob)
    total_preds      = await count(Prediction)
    total_batch      = await count(BatchJob)
    total_keys       = await count(ApiKey)

    # Try to get DB size (PostgreSQL)
    try:
        db_size = (await db.execute(
            text("SELECT pg_database_size(current_database()) / 1024.0 / 1024.0")
        )).scalar_one()
        db_size_mb = round(float(db_size), 2)
    except Exception:
        db_size_mb = 0.0

    return SystemStats(
        total_users=total_users,
        active_users=active_users,
        total_projects=total_projects,
        total_datasets=total_datasets,
        total_models=total_models,
        total_training_jobs=total_jobs,
        total_predictions=total_preds,
        total_batch_jobs=total_batch,
        total_api_keys=total_keys,
        db_size_mb=db_size_mb,
        uptime_info=f"Running since {datetime.utcnow().strftime('%Y-%m-%d')}",
    )


@admin_router.get("/audit-log")
async def get_audit_log(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Recent platform audit events."""
    from app.models.api_key import AuditLog
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(r.id),
            "action": r.action,
            "resource_type": r.resource_type,
            "resource_id": str(r.resource_id) if r.resource_id else None,
            "user_id": str(r.user_id) if r.user_id else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
