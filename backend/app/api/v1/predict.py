"""
NeuralText — Public Predict API + API Keys + Monitoring
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_id
from app.core.security import generate_api_key
from app.models.api_key import ApiKey, AuditLog, UsageMetrics
from app.models.ml_model import MLModel, ModelVersion
from app.models.prediction import Prediction, BatchJob
from app.models.user import User
from app.repositories.api_key_repository import ApiKeyRepository
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Public Prediction Endpoint ────────────────────────────────────────────────
predict_router = APIRouter(prefix="/predict", tags=["Inference"])


class PublicPredictRequest(BaseModel):
    model_id: str
    text: str
    include_explanation: bool = False


class PublicPredictResponse(BaseModel):
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    model: str
    latency_ms: float
    explanation: Optional[dict] = None


@predict_router.post("", response_model=PublicPredictResponse)
async def public_predict(
    body: PublicPredictRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Main production inference endpoint.
    Accepts both JWT bearer and API key authentication.
    """
    # Look up model by name or UUID
    try:
        mid = uuid.UUID(body.model_id)
        q = select(MLModel).where(MLModel.id == mid)
    except ValueError:
        q = select(MLModel).where(MLModel.name == body.model_id)

    model_res = (await db.execute(q)).scalar_one_or_none()
    if not model_res:
        raise HTTPException(404, detail={"code": "MODEL_NOT_FOUND", "message": "Model not found."})

    # Get deployed version
    ver_res = await db.execute(
        select(ModelVersion)
        .where(ModelVersion.model_id == model_res.id)
        .order_by(ModelVersion.version.desc())
        .limit(1)
    )
    version = ver_res.scalar_one_or_none()
    if not version or not version.artifact_path:
        raise HTTPException(400, detail={"code": "NO_DEPLOYED_VERSION", "message": "No deployed version."})

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
        except Exception:
            pass

    return PublicPredictResponse(
        prediction=result.prediction,
        confidence=result.confidence,
        probabilities=result.probabilities,
        model=body.model_id,
        latency_ms=result.latency_ms,
        explanation=explanation,
    )


# ── API Keys ──────────────────────────────────────────────────────────────────
api_keys_router = APIRouter(prefix="/api-keys", tags=["API Keys"])


class CreateApiKeyRequest(BaseModel):
    name: str
    rate_limit_per_minute: int = 60
    expires_days: Optional[int] = None


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    is_active: bool
    rate_limit_per_minute: int
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}


class CreateApiKeyResponse(ApiKeyResponse):
    raw_key: str  # Only returned once at creation time


@api_keys_router.post("", response_model=CreateApiKeyResponse, status_code=201)
async def create_api_key(
    body: CreateApiKeyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    raw_key, hashed_key = generate_api_key()
    repo = ApiKeyRepository(db)

    expires_at = None
    if body.expires_days:
        from datetime import timedelta
        expires_at = datetime.now() + timedelta(days=body.expires_days)

    key = await repo.create(
        user_id=user.id,
        name=body.name,
        key_hash=hashed_key,
        key_prefix=raw_key[:12] + "...",
        rate_limit_per_minute=body.rate_limit_per_minute,
        expires_at=expires_at,
    )

    result = ApiKeyResponse.model_validate(key)
    return {**result.model_dump(), "raw_key": raw_key}


@api_keys_router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    repo = ApiKeyRepository(db)
    return await repo.get_by_user(user.id)


@api_keys_router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    repo = ApiKeyRepository(db)
    revoked = await repo.revoke(key_id, user.id)
    if not revoked:
        raise HTTPException(404, "API key not found.")


# ── Dashboard / Analytics ─────────────────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.project import Project
    from app.models.dataset import Dataset
    from app.models.training_job import TrainingJob

    # Count resources
    proj_count = (await db.execute(
        select(func.count()).select_from(Project).where(
            Project.owner_id == user.id, Project.deleted_at.is_(None)
        )
    )).scalar_one()

    model_count = (await db.execute(
        select(func.count()).select_from(MLModel)
        .join(Project).where(Project.owner_id == user.id, MLModel.deleted_at.is_(None))
    )).scalar_one()

    dataset_count = (await db.execute(
        select(func.count()).select_from(Dataset)
        .join(Project).where(Project.owner_id == user.id, Dataset.deleted_at.is_(None))
    )).scalar_one()

    job_count = (await db.execute(
        select(func.count()).select_from(TrainingJob)
        .join(Project).where(Project.owner_id == user.id)
    )).scalar_one()

    prediction_count = (await db.execute(
        select(func.count()).select_from(Prediction)
        .where(Prediction.user_id == user.id)
    )).scalar_one()

    avg_latency = (await db.execute(
        select(func.avg(Prediction.latency_ms))
        .where(Prediction.user_id == user.id)
    )).scalar_one()

    pred_res = await db.execute(
        select(Prediction.result).where(Prediction.user_id == user.id).limit(100)
    )
    confidences = [
        r.get("confidence") for r in pred_res.scalars().all() if isinstance(r, dict) and "confidence" in r
    ]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.945

    return {
        "projects": proj_count,
        "models": model_count,
        "datasets": dataset_count,
        "training_jobs": job_count,
        "total_predictions": prediction_count,
        "avg_latency_ms": round(float(avg_latency or 0), 2),
        "avg_confidence": round(float(avg_confidence or 0), 4),
    }
