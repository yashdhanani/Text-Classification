"""
NeuralText — Training Celery Tasks
Async training jobs with real-time progress publishing to Redis.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import redis
import torch
from celery import Task
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight

from app.workers.celery_app import celery_app
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Sync Redis for Celery tasks
_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)


def publish_progress(channel: str, data: dict) -> None:
    """Publish training progress to Redis pub/sub channel."""
    try:
        _redis.publish(channel, json.dumps(data))
    except Exception as e:
        logger.warning("Failed to publish progress", error=str(e))


def update_job_status(job_id: str, status: str, **kwargs) -> None:
    """Store job status in Redis for fast lookup."""
    data = {"status": status, "job_id": job_id, **kwargs}
    _redis.setex(f"job:{job_id}", 86400, json.dumps(data))


@celery_app.task(bind=True, name="app.workers.training_tasks.train_model", max_retries=1)
def train_model(self, job_id: str, config: dict) -> dict:
    """
    Main training task.
    config keys: model_type, dataset_train_path, dataset_val_path,
                 label_column, text_column, label_map, hyperparams, artifact_output_path
    """
    channel = f"training:{job_id}"

    try:
        update_job_status(job_id, "running", started_at=datetime.now(timezone.utc).isoformat())
        publish_progress(channel, {"type": "started", "job_id": job_id})

        model_type = config["model_type"]
        artifact_path = Path(config["artifact_output_path"])
        artifact_path.mkdir(parents=True, exist_ok=True)

        hp = config.get("hyperparams", {})

        # ── Load Data ────────────────────────────────────────────────────────
        publish_progress(channel, {"type": "status", "message": "Loading dataset..."})
        train_df = pd.read_parquet(config["dataset_train_path"])
        val_df = pd.read_parquet(config["dataset_val_path"])

        text_col = config["text_column"]
        label_col = config["label_column"]
        label_map: dict = config.get("label_map") or {}

        train_texts = train_df[text_col].fillna("").tolist()
        val_texts = val_df[text_col].fillna("").tolist()
        train_labels = train_df[label_col].astype(int).tolist()
        val_labels = val_df[label_col].astype(int).tolist()

        if not label_map:
            classes = config.get("classes") or []
            if classes:
                label_map = {str(i): str(name) for i, name in enumerate(classes)}
            else:
                unique_lbls = sorted(set(train_labels + val_labels))
                label_map = {str(i): f"Class {i}" for i in unique_lbls}

        num_classes = max(len(label_map), len(set(train_labels + val_labels)))

        # Reproducibility
        seed = hp.get("random_seed", 42)
        torch.manual_seed(seed)
        np.random.seed(seed)

        # Device
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else
            "cpu"
        )

        # Class weights for imbalanced datasets
        labels_np = np.array(train_labels)
        class_weights = compute_class_weight(
            "balanced", classes=np.unique(labels_np), y=labels_np
        )
        weight_tensor = torch.tensor(class_weights, dtype=torch.float32)

        # ── Preprocessing ────────────────────────────────────────────────────
        from app.ml.preprocessing.text_cleaner import PreprocessingConfig, TextPreprocessor
        from app.ml.training.trainer import Trainer, TrainingConfig

        if model_type in ("lstm", "bilstm", "cnn_lstm"):
            from app.ml.preprocessing.tokenizer import LSTMTokenizer
            from app.ml.models.lstm import build_lstm_model

            publish_progress(channel, {"type": "status", "message": "Building vocabulary (training data only)..."})
            preprocessor = TextPreprocessor(PreprocessingConfig.for_lstm())
            clean_train = preprocessor.clean_batch(train_texts)
            clean_val = preprocessor.clean_batch(val_texts)

            # Fit tokenizer ONLY on training data — no leakage
            tokenizer = LSTMTokenizer(
                max_vocab_size=hp.get("max_vocab_size", 50000),
                min_freq=hp.get("min_freq", 2),
                max_length=hp.get("max_length", 256),
            )
            X_train = tokenizer.fit_transform(clean_train)
            X_val = tokenizer.transform(clean_val)

            # Save tokenizer
            tokenizer.save(artifact_path / "tokenizer")

            train_dataset = TensorDataset(
                torch.tensor(X_train, dtype=torch.long),
                torch.tensor(train_labels, dtype=torch.long),
            )
            val_dataset = TensorDataset(
                torch.tensor(X_val, dtype=torch.long),
                torch.tensor(val_labels, dtype=torch.long),
            )
            model = build_lstm_model(model_type, tokenizer.vocab_size, num_classes, hp)

        else:  # transformer
            from transformers import AutoTokenizer
            from app.ml.models.transformer import build_transformer_model

            model_name = hp.get("transformer_model_name", "distilbert-base-uncased")
            publish_progress(channel, {"type": "status", "message": f"Loading {model_name} tokenizer..."})

            preprocessor = TextPreprocessor(PreprocessingConfig.for_transformer())
            clean_train = preprocessor.clean_batch(train_texts)
            clean_val = preprocessor.clean_batch(val_texts)

            hf_tokenizer = AutoTokenizer.from_pretrained(
                model_name, cache_dir=settings.HUGGINGFACE_CACHE_DIR
            )
            max_len = hp.get("max_seq_length", 128)

            def encode(texts):
                enc = hf_tokenizer(
                    texts, padding="max_length", truncation=True,
                    max_length=max_len, return_tensors="pt"
                )
                return enc

            publish_progress(channel, {"type": "status", "message": "Tokenizing..."})
            train_enc = encode(clean_train)
            val_enc = encode(clean_val)

            has_tti = "token_type_ids" in train_enc

            if has_tti:
                train_dataset = TensorDataset(
                    train_enc["input_ids"], train_enc["attention_mask"],
                    torch.tensor(train_labels, dtype=torch.long),
                    train_enc["token_type_ids"],
                )
                val_dataset = TensorDataset(
                    val_enc["input_ids"], val_enc["attention_mask"],
                    torch.tensor(val_labels, dtype=torch.long),
                    val_enc["token_type_ids"],
                )
            else:
                train_dataset = TensorDataset(
                    train_enc["input_ids"], train_enc["attention_mask"],
                    torch.tensor(train_labels, dtype=torch.long),
                )
                val_dataset = TensorDataset(
                    val_enc["input_ids"], val_enc["attention_mask"],
                    torch.tensor(val_labels, dtype=torch.long),
                )

            model = build_transformer_model(
                model_name, num_classes, hp, cache_dir=settings.HUGGINGFACE_CACHE_DIR
            )
            # Save tokenizer reference
            hf_tokenizer.save_pretrained(str(artifact_path / "hf_tokenizer"))

        batch_size = hp.get("batch_size", 32)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

        total_epochs = hp.get("num_epochs", 5)

        # ── Train ────────────────────────────────────────────────────────────
        training_config = TrainingConfig(
            num_epochs=total_epochs,
            batch_size=batch_size,
            learning_rate=hp.get("learning_rate", 2e-4),
            weight_decay=hp.get("weight_decay", 1e-4),
            optimizer=hp.get("optimizer", "adamw"),
            scheduler=hp.get("scheduler", "none"),
            early_stopping_patience=hp.get("early_stopping_patience", 3),
            use_mixed_precision=hp.get("use_mixed_precision", True),
            model_type=model_type,
            transformer_model_name=hp.get("transformer_model_name", "distilbert-base-uncased"),
            random_seed=seed,
            grad_clip=hp.get("grad_clip", 1.0),
        )

        def on_epoch(epoch_metrics: dict) -> None:
            epoch_metrics["type"] = "epoch"
            epoch_metrics["progress"] = epoch_metrics["epoch"] / total_epochs * 100
            publish_progress(channel, epoch_metrics)
            update_job_status(
                job_id, "running",
                current_epoch=epoch_metrics["epoch"],
                total_epochs=total_epochs,
                progress=epoch_metrics["progress"],
            )

        trainer = Trainer(
            model=model,
            config=training_config,
            device=device,
            num_classes=num_classes,
            class_weights=weight_tensor,
            redis_channel=channel,
            progress_callback=on_epoch,
        )

        publish_progress(channel, {"type": "status", "message": "Training started..."})
        results = trainer.train(train_loader, val_loader, total_epochs)

        # ── Save Artifacts ───────────────────────────────────────────────────
        publish_progress(channel, {"type": "status", "message": "Saving model..."})
        torch.save(model.state_dict(), artifact_path / "model.pt")

        # Save metadata
        import json as _json
        metadata = {
            "model_type": model_type,
            "label_map": label_map,
            "num_classes": num_classes,
            "config": hp,
            "training_results": results["final_metrics"],
            "random_seed": seed,
            "device": str(device),
        }
        with open(artifact_path / "metadata.json", "w") as f:
            _json.dump(metadata, f, indent=2)

        final_metrics = results["final_metrics"]
        final_metrics["confusion_matrix"] = results["confusion_matrix"]
        final_metrics["classification_report"] = results["classification_report"]
        final_metrics["history"] = results["history"]

        update_job_status(
            job_id, "completed",
            metrics=final_metrics,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        publish_progress(channel, {
            "type": "completed",
            "metrics": final_metrics,
            "job_id": job_id,
        })

        # Update DB using synchronous session (safe from threads/subprocesses)
        try:
            from app.core.database import SyncSessionLocal
            from app.models.training_job import TrainingJob
            from app.models.ml_model import MLModel, ModelVersion
            from sqlalchemy import update as _update, select as _select
            import uuid as _uuid

            with SyncSessionLocal() as session:
                # Update TrainingJob
                session.execute(
                    _update(TrainingJob)
                    .where(TrainingJob.id == _uuid.UUID(job_id))
                    .values(
                        status="completed",
                        current_epoch=total_epochs,
                        progress=100.0,
                        training_log=final_metrics,
                        completed_at=datetime.now(timezone.utc),
                    )
                )

                # Fetch job for project_id
                job_obj = session.execute(
                    _select(TrainingJob).where(TrainingJob.id == _uuid.UUID(job_id))
                ).scalar_one_or_none()

                if job_obj:
                    ml_model = MLModel(
                        project_id=job_obj.project_id,
                        name=job_obj.name,
                        architecture=job_obj.model_architecture,
                        framework="pytorch",
                        task_type="classification",
                        label_map=label_map,
                        num_classes=num_classes,
                        status="active",
                    )
                    session.add(ml_model)
                    session.flush()

                    model_version = ModelVersion(
                        model_id=ml_model.id,
                        version=1,
                        stage="staging",
                        metrics=final_metrics,
                        artifact_path=str(artifact_path),
                    )
                    session.add(model_version)

                session.commit()

        except Exception as db_err:
            logger.warning("Could not update training job in DB", error=str(db_err))

        return {"status": "completed", "metrics": final_metrics}

    except Exception as exc:
        logger.error("Training task failed", job_id=job_id, error=str(exc), exc_info=True)
        update_job_status(job_id, "failed", error=str(exc))
        publish_progress(channel, {"type": "failed", "error": str(exc), "job_id": job_id})
        raise
