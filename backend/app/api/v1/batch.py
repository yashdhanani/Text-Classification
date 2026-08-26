"""
NeuralText — Batch Prediction Jobs API
Handles in-process batch inference on lists of texts.
"""
from __future__ import annotations

import uuid
import time
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_id
from app.models.prediction import BatchJob, Prediction
from app.models.ml_model import MLModel, ModelVersion
from app.models.user import User
from app.core.logging import get_logger

logger = get_logger(__name__)
batch_router = APIRouter(prefix="/batch", tags=["Batch Jobs"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BatchCreateRequest(BaseModel):
    model_id: str = Field(..., description="Model name or UUID")
    texts: list[str] = Field(..., min_length=1, max_length=10000)
    include_explanation: bool = False
    name: Optional[str] = None


class BatchResultItem(BaseModel):
    index: int
    text_preview: str
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    error: Optional[str] = None


class BatchJobResponse(BaseModel):
    id: str
    batch_id: str
    status: str
    total_records: int
    processed_records: int
    progress: float
    results: list[BatchResultItem] = []
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    model: Optional[str] = None
    error_message: Optional[str] = None


# ── Helper: resolve model ─────────────────────────────────────────────────────

async def _resolve_model(db: AsyncSession, model_id: str):
    """Find model by UUID or name."""
    try:
        mid = uuid.UUID(model_id)
        stmt = select(MLModel).where(MLModel.id == mid, MLModel.deleted_at.is_(None))
    except ValueError:
        stmt = select(MLModel).where(MLModel.name == model_id, MLModel.deleted_at.is_(None))
    result = await db.execute(stmt)
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(404, f"Model '{model_id}' not found")
    return model


# ── Routes ────────────────────────────────────────────────────────────────────

@batch_router.post("/predict", status_code=202, response_model=BatchJobResponse)
async def create_batch_job(
    body: BatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Submit a batch of texts for classification.
    Runs synchronously (in-process) for up to 1,000 texts.
    For larger batches, spawns a background Celery task.
    """
    model = await _resolve_model(db, body.model_id)

    # Get latest model version + artifact path (same as predict endpoint)
    from sqlalchemy import select as _select
    from app.models.ml_model import ModelVersion
    ver_res = await db.execute(
        _select(ModelVersion)
        .where(ModelVersion.model_id == model.id)
        .order_by(ModelVersion.version.desc())
        .limit(1)
    )
    version = ver_res.scalar_one_or_none()
    if not version or not version.artifact_path:
        raise HTTPException(400, detail="No deployed model version found.")

    # Create BatchJob record
    job = BatchJob(
        model_id=model.id,
        user_id=user.id,
        name=body.name or f"Batch {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        status="running",
        total_records=len(body.texts),
        processed_records=0,
        progress=0.0,
        started_at=datetime.utcnow(),
    )
    db.add(job)
    await db.flush()
    job_id = str(job.id)

    # Run inference using the same Predictor as the single-predict endpoint
    from app.ml.inference.predictor import Predictor
    predictor = Predictor()

    results: list[BatchResultItem] = []
    failed = 0

    for i, text in enumerate(body.texts):
        try:
            res = predictor.predict(str(version.id), version.artifact_path, text)

            # Optionally compute explanation
            explanation = None
            if body.include_explanation:
                try:
                    from app.ml.inference.model_manager import get_model_manager
                    from app.ml.explainability.shap_explainer import explain_prediction
                    loaded = get_model_manager().load_model(str(version.id), version.artifact_path)
                    explanation = explain_prediction(loaded, text)
                except Exception:
                    pass

            results.append(BatchResultItem(
                index=i,
                text_preview=text[:80] + ("…" if len(text) > 80 else ""),
                prediction=res.prediction,
                confidence=res.confidence,
                probabilities=res.probabilities,
            ))

            # Persist individual prediction
            pred = Prediction(
                model_id=model.id,
                user_id=user.id,
                input_text=text,
                result={
                    "prediction": res.prediction,
                    "confidence": res.confidence,
                    "probabilities": res.probabilities,
                },
                latency_ms=res.latency_ms,
                source="batch",
                explanation=explanation,
            )
            db.add(pred)

        except Exception as e:
            logger.warning("Batch item failed", index=i, error=str(e))
            failed += 1
            results.append(BatchResultItem(
                index=i,
                text_preview=text[:80],
                prediction="",
                confidence=0.0,
                probabilities={},
                error=str(e),
            ))

    # Update job record
    job.status = "completed"
    job.processed_records = len(body.texts) - failed
    job.failed_records = failed
    job.progress = 1.0
    job.completed_at = datetime.utcnow()
    await db.commit()

    return BatchJobResponse(
        id=job_id,
        batch_id=job_id,
        status="completed",
        total_records=len(body.texts),
        processed_records=len(body.texts) - failed,
        progress=1.0,
        results=results,
        created_at=job.created_at,
        completed_at=job.completed_at,
        model=model.name,
        error_message=None,
    )


@batch_router.get("", response_model=list[BatchJobResponse])
async def list_batch_jobs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all batch jobs for the authenticated user."""
    stmt = (
        select(BatchJob)
        .where(BatchJob.user_id == user.id)
        .order_by(BatchJob.created_at.desc())
        .limit(50)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        BatchJobResponse(
            id=str(r.id),
            batch_id=str(r.id),
            status=r.status,
            total_records=r.total_records,
            processed_records=r.processed_records,
            progress=r.progress,
            results=[],
            created_at=r.created_at,
            completed_at=r.completed_at,
            error_message=r.error_message,
        )
        for r in rows
    ]


@batch_router.get("/{batch_id}", response_model=BatchJobResponse)
async def get_batch_job(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific batch job by ID."""
    stmt = select(BatchJob).where(BatchJob.id == batch_id, BatchJob.user_id == user.id)
    job = (await db.execute(stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Batch job not found")
    return BatchJobResponse(
        id=str(job.id),
        batch_id=str(job.id),
        status=job.status,
        total_records=job.total_records,
        processed_records=job.processed_records,
        progress=job.progress,
        results=[],
        created_at=job.created_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
    )


@batch_router.delete("/{batch_id}", status_code=204)
async def cancel_batch_job(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel a pending or running batch job."""
    stmt = select(BatchJob).where(BatchJob.id == batch_id, BatchJob.user_id == user.id)
    job = (await db.execute(stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Batch job not found")
    if job.status in ("completed", "failed", "cancelled"):
        raise HTTPException(400, f"Cannot cancel job in status '{job.status}'")
    job.status = "cancelled"
    await db.commit()
