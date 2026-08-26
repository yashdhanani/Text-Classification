"""
NeuralText — HuggingFace Transformer Classifier
Supports BERT, DistilBERT, RoBERTa, and any HuggingFace model.
Fine-tuning with frozen encoder option, configurable classification head.
"""
from __future__ import annotations

import torch
import torch.nn as nn
from typing import Optional

from transformers import AutoConfig, AutoModel, AutoTokenizer
from transformers.modeling_outputs import BaseModelOutput


class TransformerClassifier(nn.Module):
    """
    Generic HuggingFace transformer classification wrapper.
    Supports any AutoModel-compatible checkpoint.
    """

    def __init__(
        self,
        model_name: str,
        num_classes: int,
        freeze_encoder: bool = False,
        dropout: float = 0.1,
        hidden_dim: Optional[int] = None,
        cache_dir: Optional[str] = None,
    ) -> None:
        super().__init__()
        self.model_name = model_name
        self.num_classes = num_classes

        # Load config and base model
        self.config = AutoConfig.from_pretrained(model_name, cache_dir=cache_dir)
        self.encoder = AutoModel.from_pretrained(model_name, cache_dir=cache_dir)

        # Determine hidden size from config
        encoder_hidden = getattr(self.config, "hidden_size", 768)

        if freeze_encoder:
            for param in self.encoder.parameters():
                param.requires_grad = False

        # Classification head
        self.dropout = nn.Dropout(dropout)
        if hidden_dim:
            self.classifier = nn.Sequential(
                nn.Linear(encoder_hidden, hidden_dim),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, num_classes),
            )
        else:
            self.classifier = nn.Linear(encoder_hidden, num_classes)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        token_type_ids: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        kwargs = dict(input_ids=input_ids, attention_mask=attention_mask)
        if token_type_ids is not None:
            kwargs["token_type_ids"] = token_type_ids

        outputs = self.encoder(**kwargs)

        # Use [CLS] token representation (first token)
        if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
            pooled = outputs.pooler_output          # BERT-style
        else:
            pooled = outputs.last_hidden_state[:, 0, :]  # RoBERTa / DistilBERT

        pooled = self.dropout(pooled)
        logits = self.classifier(pooled)
        return logits

    def get_attention_weights(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> Optional[torch.Tensor]:
        """Extract last-layer attention weights for visualization."""
        with torch.no_grad():
            outputs = self.encoder(
                input_ids=input_ids,
                attention_mask=attention_mask,
                output_attentions=True,
            )
        if outputs.attentions:
            # Last layer, averaged over heads, first sample in batch
            last_layer_attn = outputs.attentions[-1]  # (B, heads, T, T)
            avg_attn = last_layer_attn.mean(dim=1)    # (B, T, T)
            # CLS token attention over all other tokens
            cls_attn = avg_attn[:, 0, :]              # (B, T)
            return cls_attn
        return None


def build_transformer_model(
    model_name: str,
    num_classes: int,
    config: dict,
    cache_dir: Optional[str] = None,
) -> TransformerClassifier:
    """Factory for transformer classifiers."""
    return TransformerClassifier(
        model_name=model_name,
        num_classes=num_classes,
        freeze_encoder=config.get("freeze_encoder", False),
        dropout=config.get("dropout", 0.1),
        hidden_dim=config.get("classifier_hidden_dim", None),
        cache_dir=cache_dir,
    )


def load_tokenizer(model_name: str, cache_dir: Optional[str] = None) -> AutoTokenizer:
    """Load the tokenizer for a given model name."""
    return AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)
