"""
NeuralText — Datasets API
Upload, validate, preview, statistics, split.
"""
from __future__ import annotations

import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.dataset import Dataset, DatasetVersion
from app.models.project import Project
from app.models.user import User
from app.utils.storage import get_storage

router = APIRouter(prefix="/datasets", tags=["Datasets"])

UPLOAD_DIR = Path("/tmp/neuraltext/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class DatasetResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    file_format: Optional[str]
    status: str
    schema_info: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class SplitConfig(BaseModel):
    dataset_id: uuid.UUID
    text_column: str
    label_column: str
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    seed: int = 42


class DatasetVersionResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    version: int
    text_column: Optional[str]
    label_column: Optional[str]
    split_config: Optional[dict]
    stats: Optional[dict]
    train_path: Optional[str]
    val_path: Optional[str]
    test_path: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/upload", response_model=DatasetResponse, status_code=201)
async def upload_dataset(
    project_id: uuid.UUID = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Validate project ownership
    proj_result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    if not proj_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found.")

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.ALLOWED_DATASET_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext!r} not allowed. Allowed: {settings.ALLOWED_DATASET_EXTENSIONS}"
        )

    # Validate file size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit.")

    # Save locally first
    local_path = UPLOAD_DIR / f"{uuid.uuid4()}{ext}"
    async with aiofiles.open(local_path, "wb") as f_out:
        await f_out.write(content)

    # Create dataset record
    dataset = Dataset(
        project_id=project_id,
        name=name,
        description=description,
        file_name=file.filename,
        file_size=len(content),
        file_format=ext.lstrip("."),
        file_path=str(local_path),
        status="processing",
    )
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)

    # Trigger async processing in-process (no Celery worker required)
    import asyncio as _asyncio
    from app.workers.dataset_tasks import process_dataset
    loop = _asyncio.get_event_loop()
    loop.run_in_executor(
        None,
        lambda: process_dataset.apply(args=[str(dataset.id), str(local_path), {}])
    )

    return dataset


@router.get("", response_model=list[DatasetResponse])
async def list_datasets(
    project_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        select(Dataset)
        .join(Project, Dataset.project_id == Project.id)
        .where(Project.owner_id == user.id, Dataset.deleted_at.is_(None))
    )
    if project_id:
        q = q.where(Dataset.project_id == project_id)
    result = await db.execute(q.order_by(Dataset.created_at.desc()))
    return list(result.scalars().all())


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dataset = await _get_dataset_or_404(db, dataset_id, user.id)
    return dataset


@router.get("/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: uuid.UUID,
    rows: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return first N rows as JSON for UI preview."""
    import pandas as pd
    dataset = await _get_dataset_or_404(db, dataset_id, user.id)
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="File not available.")

    try:
        ext = Path(dataset.file_path).suffix.lower()
        if ext == ".csv":
            df = pd.read_csv(dataset.file_path, nrows=rows)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(dataset.file_path, nrows=rows)
        elif ext == ".parquet":
            df = pd.read_parquet(dataset.file_path).head(rows)
        elif ext == ".json":
            df = pd.read_json(dataset.file_path).head(rows)
        elif ext == ".jsonl":
            df = pd.read_json(dataset.file_path, lines=True).head(rows)
        else:
            df = pd.read_csv(dataset.file_path, nrows=rows)

        # Decode HTML entities in all string columns
        # (AG News / web-scraped data uses bare #39; without &)
        import html as _html
        import re as _re

        def _fix_entities(v: str) -> str:
            if not v or v == "nan":
                return v
            v = _re.sub(r'(?<!&)#(\d+);', r'&#\1;', v)
            v = _re.sub(r'(?<!&)(amp|lt|gt|quot|apos|nbsp);', r'&\1;', v)
            return _html.unescape(v)

        for col in df.select_dtypes(include="object").columns:
            df[col] = df[col].astype(str).apply(_fix_entities)

        return {"columns": list(df.columns), "rows": df.fillna("").to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read file: {e}")


@router.get("/{dataset_id}/stats")
async def dataset_stats(
    dataset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return cached processing stats from Redis."""
    import redis as sync_redis
    r = sync_redis.from_url(settings.REDIS_URL, decode_responses=True)
    raw = r.get(f"dataset:{dataset_id}")
    if raw:
        return json.loads(raw)
    dataset = await _get_dataset_or_404(db, dataset_id, user.id)
    return {"status": dataset.status, "schema_info": dataset.schema_info}


@router.post("/{dataset_id}/split", response_model=DatasetVersionResponse, status_code=201)
async def split_dataset(
    dataset_id: uuid.UUID,
    config: SplitConfig,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dataset = await _get_dataset_or_404(db, dataset_id, user.id)
    if not dataset.file_path:
        raise HTTPException(status_code=400, detail="Dataset file not available.")

    # Determine next version number
    versions_result = await db.execute(
        select(DatasetVersion).where(DatasetVersion.dataset_id == dataset_id)
    )
    existing = list(versions_result.scalars().all())
    next_version = max((v.version for v in existing), default=0) + 1

    output_dir = f"/tmp/neuraltext/splits/{dataset_id}/v{next_version}"

    version = DatasetVersion(
        dataset_id=dataset_id,
        version=next_version,
        text_column=config.text_column,
        label_column=config.label_column,
        split_config=config.model_dump(mode="json"),
    )
    db.add(version)
    await db.flush()
    await db.refresh(version)

    # Run split in-process via thread executor (no Celery worker required)
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from app.workers.dataset_tasks import split_dataset as split_task

    split_cfg = {
        "text_col": config.text_column,
        "label_col": config.label_column,
        "train_ratio": config.train_ratio,
        "val_ratio": config.val_ratio,
        "test_ratio": config.test_ratio,
        "seed": config.seed,
        "output_dir": output_dir,
    }

    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        None,
        lambda: split_task.apply(args=[str(version.id), dataset.file_path, split_cfg])
    )

    return version


@router.get("/{dataset_id}/versions", response_model=list[DatasetVersionResponse])
async def list_dataset_versions(
    dataset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_dataset_or_404(db, dataset_id, user.id)
    result = await db.execute(
        select(DatasetVersion)
        .where(DatasetVersion.dataset_id == dataset_id)
        .order_by(DatasetVersion.version.desc())
    )
    return list(result.scalars().all())


async def _get_dataset_or_404(db: AsyncSession, dataset_id: uuid.UUID, user_id: uuid.UUID) -> Dataset:
    result = await db.execute(
        select(Dataset)
        .join(Project, Dataset.project_id == Project.id)
        .where(Dataset.id == dataset_id, Project.owner_id == user_id, Dataset.deleted_at.is_(None))
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return dataset
