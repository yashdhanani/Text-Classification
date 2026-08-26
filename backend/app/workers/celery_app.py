"""
NeuralText — Celery Application
"""
from __future__ import annotations

from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "neuraltext",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.training_tasks",
        "app.workers.dataset_tasks",
        "app.workers.batch_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.training_tasks.*": {"queue": "training"},
        "app.workers.dataset_tasks.*": {"queue": "datasets"},
        "app.workers.batch_tasks.*": {"queue": "batch"},
    },
)
