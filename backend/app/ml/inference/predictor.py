"""
NeuralText — Predictor
Single-sample and batch inference with softmax probabilities,
latency measurement, and token counting.
"""
from __future__ import annotations

import time
from typing import Any, Optional

import numpy as np
import torch
import torch.nn.functional as F

from app.ml.inference.model_manager import LoadedModel, ModelManager, get_model_manager
from app.core.logging import get_logger

logger = get_logger(__name__)


class PredictionResult:
    """Structured prediction output."""

    def __init__(
        self,
        prediction: str,
        confidence: float,
        probabilities: dict[str, float],
        model_id: str,
        model_type: str,
        latency_ms: float,
        token_count: int,
        input_text: str,
        preprocessed_text: Optional[str] = None,
    ) -> None:
        self.prediction = prediction
        self.confidence = confidence
        self.probabilities = probabilities
        self.model_id = model_id
        self.model_type = model_type
        self.latency_ms = latency_ms
        self.token_count = token_count
        self.input_text = input_text
        self.preprocessed_text = preprocessed_text

    def to_dict(self) -> dict[str, Any]:
        return {
            "prediction": self.prediction,
            "confidence": self.confidence,
            "probabilities": self.probabilities,
            "model_id": self.model_id,
            "model_type": self.model_type,
            "latency_ms": self.latency_ms,
            "token_count": self.token_count,
        }


class Predictor:
    """
    Handles single and batch inference using the ModelManager cache.
    """

    def __init__(self, model_manager: Optional[ModelManager] = None) -> None:
        self.model_manager = model_manager or get_model_manager()

    def predict(
        self,
        model_id: str,
        artifact_path: str,
        text: str,
        preprocess: bool = True,
    ) -> PredictionResult:
        """Run single-sample inference."""
        t0 = time.perf_counter()

        loaded = self.model_manager.load_model(model_id, artifact_path)
        preprocessed = self._preprocess(text, loaded, preprocess)

        with torch.no_grad():
            logits = self._forward(loaded, [preprocessed])
            probs = F.softmax(logits, dim=-1)[0].cpu().numpy()

        pred_idx = int(probs.argmax())
        confidence = float(probs[pred_idx])
        prediction = loaded.label_map.get(str(pred_idx), str(pred_idx))

        probabilities = {
            loaded.label_map.get(str(i), str(i)): float(p)
            for i, p in enumerate(probs)
        }

        latency_ms = (time.perf_counter() - t0) * 1000
        token_count = self._count_tokens(loaded, preprocessed)

        loaded.inference_count += 1
        loaded.last_used = time.time()

        return PredictionResult(
            prediction=prediction,
            confidence=confidence,
            probabilities=probabilities,
            model_id=model_id,
            model_type=loaded.model_type,
            latency_ms=round(latency_ms, 2),
            token_count=token_count,
            input_text=text,
            preprocessed_text=preprocessed if preprocess else None,
        )

    def predict_batch(
        self,
        model_id: str,
        artifact_path: str,
        texts: list[str],
        batch_size: int = 32,
        preprocess: bool = True,
    ) -> list[PredictionResult]:
        """Run batch inference with chunked processing."""
        loaded = self.model_manager.load_model(model_id, artifact_path)
        results = []

        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            chunk_preprocessed = [self._preprocess(t, loaded, preprocess) for t in chunk]

            t0 = time.perf_counter()
            with torch.no_grad():
                logits = self._forward(loaded, chunk_preprocessed)
                probs_batch = F.softmax(logits, dim=-1).cpu().numpy()
            batch_latency = (time.perf_counter() - t0) * 1000 / len(chunk)

            for j, (text, preprocessed, probs) in enumerate(
                zip(chunk, chunk_preprocessed, probs_batch)
            ):
                pred_idx = int(probs.argmax())
                confidence = float(probs[pred_idx])
                prediction = loaded.label_map.get(str(pred_idx), str(pred_idx))
                probabilities = {
                    loaded.label_map.get(str(k), str(k)): float(p)
                    for k, p in enumerate(probs)
                }
                results.append(PredictionResult(
                    prediction=prediction,
                    confidence=confidence,
                    probabilities=probabilities,
                    model_id=model_id,
                    model_type=loaded.model_type,
                    latency_ms=round(batch_latency, 2),
                    token_count=self._count_tokens(loaded, preprocessed),
                    input_text=text,
                ))

        loaded.inference_count += len(texts)
        return results

    def _preprocess(self, text: str, loaded: LoadedModel, apply: bool) -> str:
        if not apply:
            return text
        from app.ml.preprocessing.text_cleaner import PreprocessingConfig, TextPreprocessor
        config = (
            PreprocessingConfig.for_transformer()
            if loaded.is_transformer
            else PreprocessingConfig.for_lstm()
        )
        return TextPreprocessor(config).clean(text)

    def _forward(self, loaded: LoadedModel, texts: list[str]) -> torch.Tensor:
        if loaded.is_transformer:
            enc = loaded.tokenizer(
                texts,
                padding=True,
                truncation=True,
                max_length=loaded.config.get("max_seq_length", 128),
                return_tensors="pt",
            )
            input_ids = enc["input_ids"].to(loaded.device)
            attention_mask = enc["attention_mask"].to(loaded.device)
            token_type_ids = enc.get("token_type_ids")
            if token_type_ids is not None:
                token_type_ids = token_type_ids.to(loaded.device)
            return loaded.model(input_ids, attention_mask, token_type_ids)
        else:
            sequences = loaded.tokenizer.transform(texts)
            input_ids = torch.tensor(sequences, dtype=torch.long).to(loaded.device)
            return loaded.model(input_ids)

    def _count_tokens(self, loaded: LoadedModel, text: str) -> int:
        if loaded.is_transformer:
            tokens = loaded.tokenizer.encode(text, add_special_tokens=True)
            return len(tokens)
        return len(text.split())
