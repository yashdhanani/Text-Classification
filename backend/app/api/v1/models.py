"""
NeuralText — Models & Predictions API
Registry, deployment, single predict, batch predict, explainability, comparison.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.ml_model import Deployment, MLModel, ModelVersion
from app.models.prediction import BatchJob, Prediction
from app.models.project import Project
from app.models.user import User
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/models", tags=["Models"])


# ── Schemas ───────────────────────────────────────────────────────────────────
class ModelResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    architecture: str
    framework: str
    task_type: str
    label_map: Optional[dict]
    num_classes: int
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ModelVersionResponse(BaseModel):
    id: uuid.UUID
    model_id: uuid.UUID
    version: int
    stage: str
    metrics: Optional[dict]
    artifact_path: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class PredictRequest(BaseModel):
    text: str
    model_version_id: Optional[uuid.UUID] = None
    include_explanation: bool = False


class PredictResponse(BaseModel):
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    model_id: str
    model_type: str
    latency_ms: float
    token_count: int
    explanation: Optional[dict] = None


class BatchPredictRequest(BaseModel):
    name: str = "Batch Job"
    model_id: uuid.UUID
    input_path: str
    text_column: str
    batch_size: int = 256


class CompareRequest(BaseModel):
    model_version_ids: list[uuid.UUID]


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[ModelResponse])
async def list_models(
    project_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        select(MLModel)
        .join(Project, MLModel.project_id == Project.id)
        .where(Project.owner_id == user.id, MLModel.deleted_at.is_(None))
    )
    if project_id:
        q = q.where(MLModel.project_id == project_id)
    result = await db.execute(q.order_by(MLModel.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _get_model_or_404(db, model_id, user.id)


@router.get("/{model_id}/versions", response_model=list[ModelVersionResponse])
async def list_model_versions(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_model_or_404(db, model_id, user.id)
    result = await db.execute(
        select(ModelVersion)
        .where(ModelVersion.model_id == model_id)
        .order_by(ModelVersion.version.desc())
    )
    return list(result.scalars().all())


@router.post("/{model_id}/deploy", status_code=200)
async def deploy_model(
    model_id: uuid.UUID,
    stage: str = "production",
    version_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    model = await _get_model_or_404(db, model_id, user.id)

    # Get version to deploy
    if version_id:
        ver_result = await db.execute(
            select(ModelVersion).where(ModelVersion.id == version_id, ModelVersion.model_id == model_id)
        )
        version = ver_result.scalar_one_or_none()
    else:
        # Latest version
        ver_result = await db.execute(
            select(ModelVersion)
            .where(ModelVersion.model_id == model_id)
            .order_by(ModelVersion.version.desc())
            .limit(1)
        )
        version = ver_result.scalar_one_or_none()

    if not version:
        raise HTTPException(404, "No model version available.")

    # Deactivate previous deployments for this stage
    prev_result = await db.execute(
        select(Deployment).where(
            Deployment.model_version_id == version.id,
            Deployment.stage == stage,
            Deployment.is_active == True,
        )
    )
    for dep in prev_result.scalars().all():
        dep.is_active = False

    # Create deployment record
    deployment = Deployment(
        model_version_id=version.id,
        stage=stage,
        deployed_at=datetime.now(timezone.utc),
        deployed_by=user.id,
        is_active=True,
    )
    db.add(deployment)
    version.stage = stage
    await db.flush()

    # Pre-load into ModelManager
    from app.ml.inference.model_manager import get_model_manager
    try:
        get_model_manager().load_model(str(version.id), version.artifact_path)
    except Exception as e:
        logger.warning("Could not pre-load model into cache", error=str(e))

    return {"message": f"Model deployed to {stage}", "version_id": str(version.id)}


@router.post("/{model_id}/predict", response_model=PredictResponse)
async def predict(
    model_id: uuid.UUID,
    body: PredictRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    model = await _get_model_or_404(db, model_id, user.id)

    # Get latest deployed version
    ver_q = select(ModelVersion).where(
        ModelVersion.model_id == model_id,
        ModelVersion.stage.in_(["production", "staging"])
    ).order_by(ModelVersion.version.desc()).limit(1)
    version = (await db.execute(ver_q)).scalar_one_or_none()

    if not version or not version.artifact_path:
        raise HTTPException(400, "No deployed model version found.")

    from app.ml.inference.predictor import Predictor
    predictor = Predictor()
    result = predictor.predict(str(version.id), version.artifact_path, body.text)

    explanation = None
    if body.include_explanation:
        try:
            from app.ml.inference.model_manager import get_model_manager
            from app.ml.explainability.shap_explainer import explain_prediction
            loaded = get_model_manager().load_model(str(version.id), version.artifact_path)
            explanation = explain_prediction(loaded, body.text)
        except Exception as e:
            logger.warning("Explainability failed", error=str(e))

    # Persist prediction
    pred_record = Prediction(
        model_id=model.id,
        user_id=user.id,
        input_text=body.text,
        result=result.to_dict(),
        latency_ms=result.latency_ms,
        token_count=result.token_count,
        explanation=explanation,
        source="playground",
    )
    db.add(pred_record)
    await db.flush()

    # Update usage metrics
    await _update_usage_metrics(db, model.id, result.latency_ms, result.prediction)

    return PredictResponse(
        **result.to_dict(),
        explanation=explanation,
    )


@router.post("/compare")
async def compare_models(
    body: CompareRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return side-by-side metrics for multiple model versions."""
    rows = []
    for vid in body.model_version_ids:
        result = await db.execute(
            select(ModelVersion).where(ModelVersion.id == vid)
        )
        version = result.scalar_one_or_none()
        if version:
            model_res = await db.execute(select(MLModel).where(MLModel.id == version.model_id))
            model = model_res.scalar_one_or_none()
            rows.append({
                "model_version_id": str(vid),
                "model_name": model.name if model else "Unknown",
                "architecture": model.architecture if model else "Unknown",
                "version": version.version,
                "stage": version.stage,
                "metrics": version.metrics or {},
            })
    return {"comparisons": rows}


@router.post("/{model_id}/batch-predict", status_code=201)
async def create_batch_job(
    model_id: uuid.UUID,
    body: BatchPredictRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    model = await _get_model_or_404(db, model_id, user.id)

    # Get deployed version
    ver_result = await db.execute(
        select(ModelVersion)
        .where(ModelVersion.model_id == model_id)
        .order_by(ModelVersion.version.desc())
        .limit(1)
    )
    version = ver_result.scalar_one_or_none()
    if not version:
        raise HTTPException(400, "No model version available.")

    output_path = f"/tmp/neuraltext/batch_results/{uuid.uuid4()}.csv"

    batch_job = BatchJob(
        model_id=model.id,
        user_id=user.id,
        name=body.name,
        input_path=body.input_path,
        output_path=output_path,
        text_column=body.text_column,
        status="queued",
    )
    db.add(batch_job)
    await db.flush()
    await db.refresh(batch_job)

    from app.workers.batch_tasks import run_batch_prediction
    celery_task = run_batch_prediction.apply_async(
        args=[str(batch_job.id), {
            "model_id": str(version.id),
            "artifact_path": version.artifact_path,
            "input_path": body.input_path,
            "output_path": output_path,
            "text_column": body.text_column,
            "batch_size": body.batch_size,
        }],
        queue="batch",
    )
    batch_job.celery_task_id = celery_task.id
    await db.flush()

    return {"batch_job_id": str(batch_job.id), "status": "queued"}


@router.websocket("/batch/{batch_job_id}/ws")
async def batch_progress_ws(batch_job_id: str, websocket: WebSocket):
    import redis.asyncio as aioredis
    await websocket.accept()
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(f"batch:{batch_job_id}")
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                await websocket.send_text(msg["data"])
                data = json.loads(msg["data"])
                if data.get("type") in ("completed", "failed"):
                    break
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


async def _get_model_or_404(db: AsyncSession, model_id: uuid.UUID, user_id: uuid.UUID) -> MLModel:
    result = await db.execute(
        select(MLModel)
        .join(Project, MLModel.project_id == Project.id)
        .where(MLModel.id == model_id, Project.owner_id == user_id, MLModel.deleted_at.is_(None))
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(404, "Model not found.")
    return model


async def _update_usage_metrics(db: AsyncSession, model_id: uuid.UUID, latency: float, prediction: str):
    from datetime import date
    from app.models.api_key import UsageMetrics
    from sqlalchemy import and_
    today = date.today()
    result = await db.execute(
        select(UsageMetrics).where(
            and_(UsageMetrics.model_id == model_id, UsageMetrics.date == today)
        )
    )
    metrics = result.scalar_one_or_none()
    if metrics:
        metrics.prediction_count += 1
        if metrics.avg_latency_ms:
            metrics.avg_latency_ms = (metrics.avg_latency_ms + latency) / 2
        else:
            metrics.avg_latency_ms = latency
    else:
        db.add(UsageMetrics(model_id=model_id, date=today, prediction_count=1, avg_latency_ms=latency))
    await db.flush()
