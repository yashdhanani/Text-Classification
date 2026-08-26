"""
NeuralText — Batch Prediction Celery Task
Chunked inference for millions of records with progress tracking.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import redis

from app.workers.celery_app import celery_app
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)


def publish_batch_progress(job_id: str, data: dict) -> None:
    try:
        _redis.publish(f"batch:{job_id}", json.dumps(data))
        _redis.setex(f"batch_job:{job_id}", 86400, json.dumps(data))
    except Exception:
        pass


@celery_app.task(bind=True, name="app.workers.batch_tasks.run_batch_prediction", max_retries=0)
def run_batch_prediction(self, job_id: str, config: dict) -> dict:
    """
    config keys: model_id, artifact_path, input_path, output_path, text_column, batch_size
    """
    try:
        from app.ml.inference.predictor import Predictor
        from app.ml.inference.model_manager import get_model_manager

        model_id = config["model_id"]
        artifact_path = config["artifact_path"]
        input_path = config["input_path"]
        output_path = config["output_path"]
        text_col = config["text_column"]
        chunk_size = config.get("batch_size", 256)

        publish_batch_progress(job_id, {
            "type": "started", "job_id": job_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        # Load input data
        if input_path.endswith(".csv"):
            df = pd.read_csv(input_path)
        elif input_path.endswith(".parquet"):
            df = pd.read_parquet(input_path)
        else:
            df = pd.read_json(input_path, lines=True)

        total = len(df)
        predictor = Predictor(get_model_manager())
        results = []

        for i in range(0, total, chunk_size):
            chunk = df.iloc[i : i + chunk_size]
            texts = chunk[text_col].fillna("").tolist()

            preds = predictor.predict_batch(model_id, artifact_path, texts, batch_size=chunk_size)

            for row_idx, (_, row) in enumerate(chunk.iterrows()):
                pred = preds[row_idx]
                results.append({
                    **row.to_dict(),
                    "prediction": pred.prediction,
                    "confidence": pred.confidence,
                    **{f"prob_{k}": v for k, v in pred.probabilities.items()},
                })

            processed = min(i + chunk_size, total)
            progress = processed / total * 100

            publish_batch_progress(job_id, {
                "type": "progress",
                "processed": processed,
                "total": total,
                "progress": round(progress, 2),
                "job_id": job_id,
            })

        # Save results
        output_df = pd.DataFrame(results)
        output_path_obj = Path(output_path)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)
        output_df.to_csv(output_path, index=False)

        publish_batch_progress(job_id, {
            "type": "completed",
            "job_id": job_id,
            "total": total,
            "output_path": output_path,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        return {"status": "completed", "total": total, "output_path": output_path}

    except Exception as exc:
        logger.error("Batch prediction failed", job_id=job_id, error=str(exc))
        publish_batch_progress(job_id, {"type": "failed", "error": str(exc), "job_id": job_id})
        raise
