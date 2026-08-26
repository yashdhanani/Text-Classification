"""
NeuralText — Model Manager (Inference Cache)
Keeps active models in memory to avoid loading on every request.
Thread-safe LRU cache with device-aware placement.
"""
from __future__ import annotations

import asyncio
import json
import pickle
import time
from collections import OrderedDict
from pathlib import Path
from threading import Lock
from typing import Any, Optional

import torch
import torch.nn as nn
import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Global singleton
_model_manager: Optional["ModelManager"] = None


def get_model_manager() -> "ModelManager":
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager


class LoadedModel:
    """Container for a loaded model with metadata."""

    def __init__(
        self,
        model_id: str,
        model: nn.Module,
        model_type: str,  # lstm | bilstm | cnn_lstm | transformer
        tokenizer: Any,   # LSTMTokenizer or HuggingFace tokenizer
        label_map: dict[str, str],
        config: dict,
        device: torch.device,
    ) -> None:
        self.model_id = model_id
        self.model = model
        self.model_type = model_type
        self.tokenizer = tokenizer
        self.label_map = label_map  # {"0": "negative", "1": "positive", ...}
        self.config = config
        self.device = device
        self.loaded_at = time.time()
        self.inference_count = 0
        self.last_used = time.time()

    @property
    def is_transformer(self) -> bool:
        return self.model_type == "transformer"


class ModelManager:
    """
    LRU in-memory model cache.
    Max capacity: 5 models (configurable).
    Automatically evicts least-recently-used models.
    """

    MAX_MODELS = 5

    def __init__(self) -> None:
        self._cache: OrderedDict[str, LoadedModel] = OrderedDict()
        self._lock = Lock()
        self._device = self._detect_device()
        logger.info("ModelManager initialized", device=str(self._device))

    def _detect_device(self) -> torch.device:
        if torch.cuda.is_available():
            return torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")

    def load_model(self, model_id: str, artifact_path: str) -> LoadedModel:
        """Load a model from disk into the cache."""
        with self._lock:
            if model_id in self._cache:
                # Move to end (most recently used)
                self._cache.move_to_end(model_id)
                self._cache[model_id].last_used = time.time()
                return self._cache[model_id]

        # Load from disk (outside lock to avoid blocking)
        loaded = self._load_from_disk(model_id, artifact_path)

        with self._lock:
            # Evict LRU if at capacity
            while len(self._cache) >= self.MAX_MODELS:
                evicted_id, _ = self._cache.popitem(last=False)
                logger.info("Evicted model from cache", model_id=evicted_id)

            self._cache[model_id] = loaded
            logger.info("Model loaded into cache", model_id=model_id, model_type=loaded.model_type)

        return loaded

    def _load_from_disk(self, model_id: str, artifact_path: str) -> LoadedModel:
        path = Path(artifact_path)

        # Load metadata
        with open(path / "metadata.json") as f:
            metadata = json.load(f)

        model_type = metadata["model_type"]
        label_map = metadata["label_map"]
        config = metadata["config"]
        num_classes = len(label_map)

        if model_type in ("lstm", "bilstm", "cnn_lstm"):
            from app.ml.models.lstm import build_lstm_model
            from app.ml.preprocessing.tokenizer import LSTMTokenizer

            tokenizer = LSTMTokenizer.load(path / "tokenizer")
            model = build_lstm_model(model_type, tokenizer.vocab_size, num_classes, config)
            state = torch.load(path / "model.pt", map_location=self._device, weights_only=True)
            model.load_state_dict(state)
        else:
            from app.ml.models.transformer import build_transformer_model, load_tokenizer

            model_name = config.get("transformer_model_name", "distilbert-base-uncased")
            tokenizer = load_tokenizer(model_name, cache_dir=settings.HUGGINGFACE_CACHE_DIR)
            model = build_transformer_model(
                model_name, num_classes, config, cache_dir=settings.HUGGINGFACE_CACHE_DIR
            )
            state = torch.load(path / "model.pt", map_location=self._device, weights_only=True)
            model.load_state_dict(state)

        model.eval()
        model.to(self._device)

        return LoadedModel(
            model_id=model_id,
            model=model,
            model_type=model_type,
            tokenizer=tokenizer,
            label_map=label_map,
            config=config,
            device=self._device,
        )

    def unload_model(self, model_id: str) -> None:
        with self._lock:
            if model_id in self._cache:
                del self._cache[model_id]
                logger.info("Model unloaded from cache", model_id=model_id)

    def is_loaded(self, model_id: str) -> bool:
        with self._lock:
            return model_id in self._cache

    def get_loaded_model_ids(self) -> list[str]:
        with self._lock:
            return list(self._cache.keys())

    def get_stats(self) -> dict:
        with self._lock:
            return {
                "loaded_models": len(self._cache),
                "max_models": self.MAX_MODELS,
                "device": str(self._device),
                "models": [
                    {
                        "model_id": m.model_id,
                        "model_type": m.model_type,
                        "inference_count": m.inference_count,
                        "loaded_at": m.loaded_at,
                        "last_used": m.last_used,
                    }
                    for m in self._cache.values()
                ],
            }
