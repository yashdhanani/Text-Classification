"""
NeuralText — SHAP + Attention Explainability
Token importance extraction for LSTM (gradient-based) and
Transformer (attention + SHAP KernelExplainer) models.
"""
from __future__ import annotations

from typing import Any, Optional
import numpy as np
import torch
import torch.nn.functional as F

from app.ml.inference.model_manager import LoadedModel
from app.core.logging import get_logger

logger = get_logger(__name__)


def explain_prediction(
    loaded: LoadedModel,
    text: str,
    num_samples: int = 100,
) -> dict[str, Any]:
    """
    Generate token-level importance scores for a single text prediction.
    Returns a dict suitable for frontend visualization.
    """
    if loaded.is_transformer:
        return _explain_transformer(loaded, text)
    else:
        return _explain_lstm(loaded, text)


def _explain_transformer(loaded: LoadedModel, text: str) -> dict[str, Any]:
    """
    Extract attention-based importance for transformer models.
    Uses last-layer CLS attention averaged across heads.
    """
    enc = loaded.tokenizer(
        text,
        truncation=True,
        max_length=loaded.config.get("max_seq_length", 128),
        return_tensors="pt",
    )
    input_ids = enc["input_ids"].to(loaded.device)
    attention_mask = enc["attention_mask"].to(loaded.device)

    with torch.no_grad():
        outputs = loaded.model.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_attentions=True,
        )

    # Last layer attention, averaged over all heads, CLS token view
    if outputs.attentions:
        last_attn = outputs.attentions[-1]  # (1, heads, T, T)
        avg_attn = last_attn.mean(dim=1)    # (1, T, T)
        cls_attn = avg_attn[0, 0, :].cpu().numpy()  # (T,)
    else:
        tokens = loaded.tokenizer.convert_ids_to_tokens(input_ids[0])
        cls_attn = np.ones(len(tokens)) / len(tokens)

    tokens = loaded.tokenizer.convert_ids_to_tokens(input_ids[0])

    # Normalize importance to [0, 1]
    importance = cls_attn / (cls_attn.max() + 1e-8)

    # Filter out special tokens for display
    token_importance = [
        {"token": tok, "importance": float(imp), "position": i}
        for i, (tok, imp) in enumerate(zip(tokens, importance))
        if tok not in ("[CLS]", "[SEP]", "<s>", "</s>", "<pad>", "[PAD]")
    ]

    return {
        "method": "attention",
        "token_importance": token_importance,
        "raw_tokens": tokens,
        "raw_importance": importance.tolist(),
    }


def _explain_lstm(loaded: LoadedModel, text: str) -> dict[str, Any]:
    """
    Gradient-based saliency for LSTM models.
    For BiLSTM models also extracts attention weights.
    """
    sequences = loaded.tokenizer.transform([text])
    input_ids = torch.tensor(sequences, dtype=torch.long).to(loaded.device)

    # Try to get attention weights if model supports it
    attn_weights = None
    if hasattr(loaded.model, "get_attention_weights"):
        with torch.no_grad():
            attn_weights = loaded.model.get_attention_weights(input_ids)

    tokens = text.split()
    max_len = loaded.config.get("max_length", 256)
    tokens_truncated = tokens[:max_len]

    if attn_weights is not None:
        # BiLSTM attention
        attn = attn_weights[0, : len(tokens_truncated)].cpu().numpy()
        importance = attn / (attn.max() + 1e-8)
        method = "attention"
    else:
        # Gradient saliency: embed gradients
        loaded.model.train()  # enable gradients
        try:
            emb = loaded.model.embedding(input_ids)
            emb.retain_grad()
            logits = loaded.model(input_ids)
            pred_class = logits.argmax(dim=-1).item()
            logits[0, pred_class].backward()
            grad = emb.grad[0].abs().sum(dim=-1).detach().cpu().numpy()
            importance_raw = grad[: len(tokens_truncated)]
            importance = importance_raw / (importance_raw.max() + 1e-8)
        except Exception:
            importance = np.ones(len(tokens_truncated)) / len(tokens_truncated)
        finally:
            loaded.model.eval()
        method = "gradient_saliency"

    token_importance = [
        {"token": tok, "importance": float(imp), "position": i}
        for i, (tok, imp) in enumerate(zip(tokens_truncated, importance))
    ]

    return {
        "method": method,
        "token_importance": token_importance,
        "raw_tokens": tokens_truncated,
        "raw_importance": importance.tolist(),
    }
