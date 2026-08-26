"""
NeuralText — Training Loop
Production-quality training engine with early stopping, checkpointing,
mixed precision, and real-time metric streaming via Redis pub/sub.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    classification_report, confusion_matrix,
)
from transformers import get_linear_schedule_with_warmup


@dataclass
class EpochMetrics:
    epoch: int
    train_loss: float
    val_loss: float
    accuracy: float
    f1: float
    precision: float
    recall: float
    learning_rate: float
    elapsed_seconds: float


@dataclass
class TrainingConfig:
    # General
    num_epochs: int = 10
    batch_size: int = 32
    learning_rate: float = 2e-4
    weight_decay: float = 1e-4
    optimizer: str = "adamw"           # adamw | adam | sgd
    scheduler: str = "cosine"          # cosine | linear_warmup | none
    warmup_ratio: float = 0.1
    grad_clip: float = 1.0
    random_seed: int = 42

    # Early stopping
    early_stopping_patience: int = 3
    early_stopping_metric: str = "val_loss"  # val_loss | f1 | accuracy
    minimize_metric: bool = True

    # Mixed precision
    use_mixed_precision: bool = True

    # Checkpointing
    save_best_only: bool = True
    checkpoint_dir: str = "/tmp/checkpoints"

    # Model type
    model_type: str = "lstm"           # lstm | bilstm | cnn_lstm | transformer

    # Transformer specific
    transformer_model_name: str = "distilbert-base-uncased"
    freeze_encoder: bool = False
    warmup_steps: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


class EarlyStopping:
    def __init__(self, patience: int = 3, minimize: bool = True, min_delta: float = 1e-4):
        self.patience = patience
        self.minimize = minimize
        self.min_delta = min_delta
        self.counter = 0
        self.best_value: Optional[float] = None
        self.should_stop = False

    def step(self, value: float) -> bool:
        if self.best_value is None:
            self.best_value = value
            return False

        improved = (
            value < self.best_value - self.min_delta
            if self.minimize
            else value > self.best_value + self.min_delta
        )

        if improved:
            self.best_value = value
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True

        return self.should_stop


class Trainer:
    """
    Generic trainer for both LSTM and Transformer models.
    Publishes epoch metrics to Redis for real-time WebSocket streaming.
    """

    def __init__(
        self,
        model: nn.Module,
        config: TrainingConfig,
        device: torch.device,
        num_classes: int,
        class_weights: Optional[torch.Tensor] = None,
        redis_channel: Optional[str] = None,
        progress_callback: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self.model = model.to(device)
        self.config = config
        self.device = device
        self.num_classes = num_classes
        self.redis_channel = redis_channel
        self.progress_callback = progress_callback

        # Loss function with optional class weighting
        self.criterion = nn.CrossEntropyLoss(
            weight=class_weights.to(device) if class_weights is not None else None
        )

        # Mixed precision scaler
        self.scaler = GradScaler() if (
            config.use_mixed_precision and device.type == "cuda"
        ) else None

        self.history: list[dict] = []
        self.best_model_state: Optional[dict] = None
        self.best_metric_value: Optional[float] = None

    def build_optimizer(self) -> torch.optim.Optimizer:
        params = filter(lambda p: p.requires_grad, self.model.parameters())
        opt = self.config.optimizer.lower()
        lr = self.config.learning_rate
        wd = self.config.weight_decay

        if opt == "adam":
            return torch.optim.Adam(params, lr=lr, weight_decay=wd)
        elif opt == "sgd":
            return torch.optim.SGD(params, lr=lr, momentum=0.9, weight_decay=wd)
        else:  # adamw (default)
            return torch.optim.AdamW(params, lr=lr, weight_decay=wd)

    def _train_epoch(
        self,
        loader: DataLoader,
        optimizer: torch.optim.Optimizer,
        scheduler=None,
    ) -> float:
        self.model.train()
        total_loss = 0.0

        for batch in loader:
            optimizer.zero_grad()

            if self.config.model_type == "transformer":
                input_ids = batch[0].to(self.device)
                attention_mask = batch[1].to(self.device)
                labels = batch[2].to(self.device)
                token_type_ids = batch[3].to(self.device) if len(batch) > 3 else None

                if self.scaler:
                    with autocast():
                        logits = self.model(input_ids, attention_mask, token_type_ids)
                        loss = self.criterion(logits, labels)
                    self.scaler.scale(loss).backward()
                    self.scaler.unscale_(optimizer)
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), self.config.grad_clip)
                    self.scaler.step(optimizer)
                    self.scaler.update()
                else:
                    logits = self.model(input_ids, attention_mask, token_type_ids)
                    loss = self.criterion(logits, labels)
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), self.config.grad_clip)
                    optimizer.step()
            else:
                input_ids = batch[0].to(self.device)
                labels = batch[1].to(self.device)
                logits = self.model(input_ids)
                loss = self.criterion(logits, labels)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), self.config.grad_clip)
                optimizer.step()

            if scheduler is not None:
                scheduler.step()

            total_loss += loss.item()

        return total_loss / len(loader)

    @torch.no_grad()
    def _eval_epoch(self, loader: DataLoader) -> tuple[float, np.ndarray, np.ndarray]:
        self.model.eval()
        total_loss = 0.0
        all_preds, all_labels = [], []

        for batch in loader:
            if self.config.model_type == "transformer":
                input_ids = batch[0].to(self.device)
                attention_mask = batch[1].to(self.device)
                labels = batch[2].to(self.device)
                token_type_ids = batch[3].to(self.device) if len(batch) > 3 else None
                logits = self.model(input_ids, attention_mask, token_type_ids)
            else:
                input_ids = batch[0].to(self.device)
                labels = batch[1].to(self.device)
                logits = self.model(input_ids)

            loss = self.criterion(logits, labels)
            total_loss += loss.item()

            preds = logits.argmax(dim=-1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(labels.cpu().numpy())

        return (
            total_loss / len(loader),
            np.array(all_preds),
            np.array(all_labels),
        )

    def train(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        total_epochs: int,
    ) -> dict[str, Any]:
        """Run the full training loop. Returns final metrics and history."""
        optimizer = self.build_optimizer()
        early_stopping = EarlyStopping(
            patience=self.config.early_stopping_patience,
            minimize=self.config.minimize_metric,
        )

        # Build LR scheduler
        scheduler = None
        if self.config.scheduler == "linear_warmup":
            total_steps = len(train_loader) * total_epochs
            warmup_steps = int(total_steps * self.config.warmup_ratio)
            scheduler = get_linear_schedule_with_warmup(
                optimizer, warmup_steps, total_steps
            )

        start_time = time.time()
        avg_params = {"average": "weighted", "zero_division": 0}

        for epoch in range(1, total_epochs + 1):
            epoch_start = time.time()

            train_loss = self._train_epoch(train_loader, optimizer, scheduler)
            val_loss, val_preds, val_labels = self._eval_epoch(val_loader)

            # Compute metrics
            acc = accuracy_score(val_labels, val_preds)
            f1 = f1_score(val_labels, val_preds, **avg_params)
            prec = precision_score(val_labels, val_preds, **avg_params)
            rec = recall_score(val_labels, val_preds, **avg_params)
            current_lr = optimizer.param_groups[0]["lr"]

            epoch_metrics = {
                "epoch": epoch,
                "total_epochs": total_epochs,
                "train_loss": round(train_loss, 6),
                "val_loss": round(val_loss, 6),
                "accuracy": round(acc, 6),
                "f1": round(f1, 6),
                "precision": round(prec, 6),
                "recall": round(rec, 6),
                "learning_rate": current_lr,
                "elapsed_seconds": round(time.time() - start_time, 1),
                "epoch_seconds": round(time.time() - epoch_start, 2),
            }
            self.history.append(epoch_metrics)

            # Checkpoint best model
            monitor_val = val_loss if self.config.minimize_metric else acc
            if self.best_metric_value is None or (
                monitor_val < self.best_metric_value
                if self.config.minimize_metric
                else monitor_val > self.best_metric_value
            ):
                self.best_metric_value = monitor_val
                self.best_model_state = {
                    k: v.cpu().clone() for k, v in self.model.state_dict().items()
                }

            # Stream progress
            if self.progress_callback:
                self.progress_callback(epoch_metrics)

            # Early stopping
            if early_stopping.step(monitor_val):
                epoch_metrics["stopped_early"] = True
                break

        # Restore best weights
        if self.best_model_state:
            self.model.load_state_dict(self.best_model_state)

        # Final evaluation
        _, final_preds, final_labels = self._eval_epoch(val_loader)
        report = classification_report(final_labels, final_preds, output_dict=True, zero_division=0)
        cm = confusion_matrix(final_labels, final_preds).tolist()

        return {
            "history": self.history,
            "best_val_loss": self.best_metric_value,
            "final_metrics": {
                "accuracy": float(accuracy_score(final_labels, final_preds)),
                "f1_weighted": float(f1_score(final_labels, final_preds, average="weighted", zero_division=0)),
                "f1_macro": float(f1_score(final_labels, final_preds, average="macro", zero_division=0)),
                "precision": float(precision_score(final_labels, final_preds, average="weighted", zero_division=0)),
                "recall": float(recall_score(final_labels, final_preds, average="weighted", zero_division=0)),
            },
            "classification_report": report,
            "confusion_matrix": cm,
            "total_seconds": round(time.time() - start_time, 1),
        }
