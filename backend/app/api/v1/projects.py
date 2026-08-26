"""
NeuralText — Projects API
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, PaginationParams
from app.models.project import Project
from app.models.user import User

router = APIRouter(prefix="/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: str = "classification"


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: Optional[str] = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    task_type: str
    status: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    page: int
    per_page: int


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(
        owner_id=user.id,
        name=body.name,
        description=body.description,
        task_type=body.task_type,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    pagination: PaginationParams = Depends(),
):
    q = select(Project).where(Project.owner_id == user.id, Project.deleted_at.is_(None))
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()
    result = await db.execute(q.offset(pagination.offset).limit(pagination.per_page).order_by(Project.created_at.desc()))
    items = list(result.scalars().all())
    return ProjectListResponse(items=items, total=total, page=pagination.page, per_page=pagination.per_page)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _get_project_or_404(db, project_id, user.id)
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _get_project_or_404(db, project_id, user.id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(project, field, val)
    await db.flush()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    project = await _get_project_or_404(db, project_id, user.id)
    project.deleted_at = datetime.now(timezone.utc)
    await db.flush()


async def _get_project_or_404(db: AsyncSession, project_id: uuid.UUID, owner_id: uuid.UUID) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == owner_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project
