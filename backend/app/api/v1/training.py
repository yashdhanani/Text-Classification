"""
NeuralText — Training Jobs API
Create, monitor, cancel training jobs. WebSocket for real-time progress.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_redis
from app.models.training_job import TrainingJob
from app.models.user import User
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/training", tags=["Training"])


class CreateTrainingJobRequest(BaseModel):
    project_id: uuid.UUID
    dataset_version_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    model_architecture: str  # lstm | bilstm | cnn_lstm | transformer
    hyperparameters: dict[str, Any] = Field(default_factory=dict)


class TrainingJobResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    model_architecture: str
    status: str
    current_epoch: int
    total_epochs: int
    progress: float
    training_log: Optional[list]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/jobs", response_model=TrainingJobResponse, status_code=201)
async def create_training_job(
    body: CreateTrainingJobRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.dataset import DatasetVersion
    from app.models.project import Project

    # Validate ownership
    proj = (await db.execute(
        select(Project).where(Project.id == body.project_id, Project.owner_id == user.id)
    )).scalar_one_or_none()
    if not proj:
        raise HTTPException(404, "Project not found.")

    dv = (await db.execute(
        select(DatasetVersion).where(DatasetVersion.id == body.dataset_version_id)
    )).scalar_one_or_none()
    if not dv:
        raise HTTPException(404, "Dataset version not found.")

    hp = body.hyperparameters
    total_epochs = hp.get("num_epochs", 5)

    job = TrainingJob(
        project_id=body.project_id,
        dataset_version_id=body.dataset_version_id,
        name=body.name,
        model_architecture=body.model_architecture,
        config=hp,
        status="queued",
        total_epochs=total_epochs,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Build artifact path
    artifact_path = f"/tmp/neuraltext/models/{job.id}"

    # Build task config
    task_config = {
        "model_type": body.model_architecture,
        "dataset_train_path": dv.train_path,
        "dataset_val_path": dv.val_path,
        "text_column": dv.text_column,
        "label_column": "_label_int",
        "label_map": (
            dv.stats.get("label_map")
            or {str(i): c for i, c in enumerate(dv.stats.get("classes", []))}
        ) if dv.stats else {},
        "hyperparams": hp,
        "artifact_output_path": artifact_path,
    }

    # Dispatch Celery task
    from app.workers.training_tasks import train_model
    celery_task = train_model.apply_async(
        args=[str(job.id), task_config],
        queue="training",
    )
    job.celery_task_id = celery_task.id
    job.status = "queued"
    await db.flush()

    return job


@router.get("/jobs", response_model=list[TrainingJobResponse])
async def list_training_jobs(
    project_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.project import Project
    q = (
        select(TrainingJob)
        .join(Project, TrainingJob.project_id == Project.id)
        .where(Project.owner_id == user.id)
        .order_by(TrainingJob.created_at.desc())
    )
    if project_id:
        q = q.where(TrainingJob.project_id == project_id)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.get("/jobs/{job_id}", response_model=TrainingJobResponse)
async def get_training_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = await _get_job_or_404(db, job_id, user.id)

    # Enrich with Redis live status
    import redis as sync_redis
    r = sync_redis.from_url(settings.REDIS_URL, decode_responses=True)
    raw = r.get(f"job:{job_id}")
    if raw:
        live = json.loads(raw)
        if live.get("status") and job.status in ("queued", "running"):
            job.status = live["status"]
            job.current_epoch = live.get("current_epoch", job.current_epoch)
            job.progress = live.get("progress", job.progress)

    return job


@router.post("/jobs/{job_id}/cancel", status_code=204)
async def cancel_training_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = await _get_job_or_404(db, job_id, user.id)
    if job.status in ("completed", "failed", "cancelled"):
        raise HTTPException(400, f"Job is already {job.status}.")

    # Revoke Celery task
    if job.celery_task_id:
        from app.workers.celery_app import celery_app
        celery_app.control.revoke(job.celery_task_id, terminate=True)

    job.status = "cancelled"
    await db.flush()


@router.websocket("/jobs/{job_id}/ws")
async def training_progress_ws(
    job_id: str,
    websocket: WebSocket,
):
    """WebSocket endpoint for real-time training progress."""
    await websocket.accept()
    pubsub = None
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(f"training:{job_id}")

        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
                data = json.loads(message["data"])
                if data.get("type") in ("completed", "failed"):
                    break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WS error", error=str(e))
    finally:
        if pubsub:
            await pubsub.unsubscribe()
        try:
            await websocket.close()
        except Exception:
            pass


async def _get_job_or_404(db: AsyncSession, job_id: uuid.UUID, user_id: uuid.UUID) -> TrainingJob:
    from app.models.project import Project
    result = await db.execute(
        select(TrainingJob)
        .join(Project, TrainingJob.project_id == Project.id)
        .where(TrainingJob.id == job_id, Project.owner_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Training job not found.")
    return job
