"""
NeuralText — PyTorch LSTM Models
Vanilla LSTM, BiLSTM with Attention, CNN-LSTM hybrid.
All models share a common interface for the training/inference pipeline.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional


# ── Attention Mechanism ───────────────────────────────────────────────────────
class BahdanauAttention(nn.Module):
    """Additive (Bahdanau) attention over LSTM hidden states."""

    def __init__(self, hidden_dim: int) -> None:
        super().__init__()
        self.attn = nn.Linear(hidden_dim * 2, hidden_dim)
        self.v = nn.Linear(hidden_dim, 1, bias=False)

    def forward(self, encoder_outputs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # encoder_outputs: (batch, seq_len, hidden_dim * 2)
        energy = torch.tanh(self.attn(encoder_outputs))  # (batch, seq_len, hidden_dim)
        attention_scores = self.v(energy).squeeze(-1)     # (batch, seq_len)
        attention_weights = F.softmax(attention_scores, dim=1)  # (batch, seq_len)
        context = torch.bmm(attention_weights.unsqueeze(1), encoder_outputs)  # (batch, 1, hidden*2)
        return context.squeeze(1), attention_weights


# ── Vanilla LSTM ──────────────────────────────────────────────────────────────
class LSTMClassifier(nn.Module):
    """
    Vanilla LSTM Text Classifier.
    Architecture: Embedding → LSTM → Dropout → Linear → Softmax
    """

    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 128,
        hidden_dim: int = 256,
        num_layers: int = 2,
        num_classes: int = 2,
        dropout: float = 0.3,
        pad_idx: int = 0,
    ) -> None:
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.lstm = nn.LSTM(
            embed_dim,
            hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_dim, num_classes)

    def forward(
        self, input_ids: torch.Tensor, lengths: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        embedded = self.dropout(self.embedding(input_ids))  # (B, T, E)
        lstm_out, (hidden, _) = self.lstm(embedded)          # hidden: (layers, B, H)
        # Use the last layer's hidden state
        out = self.dropout(hidden[-1])                        # (B, H)
        logits = self.classifier(out)                         # (B, C)
        return logits

    def get_attention_weights(self, input_ids: torch.Tensor) -> Optional[torch.Tensor]:
        return None  # Vanilla LSTM has no attention


# ── BiLSTM + Attention ────────────────────────────────────────────────────────
class BiLSTMClassifier(nn.Module):
    """
    Bidirectional LSTM with Bahdanau Attention.
    Architecture: Embedding → BiLSTM → Attention → Dropout → Linear
    """

    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 128,
        hidden_dim: int = 256,
        num_layers: int = 2,
        num_classes: int = 2,
        dropout: float = 0.3,
        pad_idx: int = 0,
        use_attention: bool = True,
    ) -> None:
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.bilstm = nn.LSTM(
            embed_dim,
            hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.attention = BahdanauAttention(hidden_dim)
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_dim * 2, num_classes)
        self._last_attn_weights: Optional[torch.Tensor] = None

    def forward(
        self, input_ids: torch.Tensor, lengths: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        embedded = self.dropout(self.embedding(input_ids))        # (B, T, E)
        lstm_out, _ = self.bilstm(embedded)                       # (B, T, H*2)
        context, attn_weights = self.attention(lstm_out)          # (B, H*2), (B, T)
        self._last_attn_weights = attn_weights.detach()
        out = self.dropout(context)
        logits = self.classifier(out)                             # (B, C)
        return logits

    def get_attention_weights(self, input_ids: torch.Tensor) -> Optional[torch.Tensor]:
        """Return attention weights for given input_ids."""
        if self._last_attn_weights is not None and self._last_attn_weights.shape[0] == input_ids.shape[0]:
            return self._last_attn_weights
        with torch.no_grad():
            embedded = self.embedding(input_ids)
            lstm_out, _ = self.bilstm(embedded)
            _, attn_weights = self.attention(lstm_out)
            return attn_weights


# ── CNN-LSTM Hybrid ───────────────────────────────────────────────────────────
class CNNLSTMClassifier(nn.Module):
    """
    CNN-LSTM hybrid: CNN extracts local n-gram features, LSTM captures sequence context.
    Architecture: Embedding → Conv1D+Pool → LSTM → Dropout → Linear
    """

    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 128,
        num_filters: int = 128,
        kernel_sizes: list[int] = None,
        hidden_dim: int = 256,
        num_layers: int = 1,
        num_classes: int = 2,
        dropout: float = 0.3,
        pad_idx: int = 0,
    ) -> None:
        super().__init__()
        if kernel_sizes is None:
            kernel_sizes = [3, 4, 5]

        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, num_filters, k, padding=k // 2)
            for k in kernel_sizes
        ])
        cnn_output_dim = num_filters * len(kernel_sizes)
        self.lstm = nn.LSTM(
            cnn_output_dim,
            hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_dim, num_classes)

    def forward(
        self, input_ids: torch.Tensor, lengths: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        T = input_ids.shape[1]
        embedded = self.dropout(self.embedding(input_ids))     # (B, T, E)
        x = embedded.permute(0, 2, 1)                          # (B, E, T)
        conv_outs = [F.relu(conv(x))[:, :, :T] for conv in self.convs]  # [(B, F, T), ...]
        x = torch.cat(conv_outs, dim=1)                        # (B, F*len, T)
        x = x.permute(0, 2, 1)                                 # (B, T, F*len)
        _, (hidden, _) = self.lstm(x)
        out = self.dropout(hidden[-1])                          # (B, H)
        logits = self.classifier(out)
        return logits

    def get_attention_weights(self, input_ids: torch.Tensor) -> Optional[torch.Tensor]:
        return None


# ── Model Factory ─────────────────────────────────────────────────────────────
def build_lstm_model(
    architecture: str,
    vocab_size: int,
    num_classes: int,
    config: dict,
) -> nn.Module:
    """
    Factory function — returns the correct LSTM variant.
    architecture: 'lstm' | 'bilstm' | 'cnn_lstm'
    """
    common = dict(
        vocab_size=vocab_size,
        embed_dim=config.get("embed_dim") or config.get("embedding_dim") or 128,
        hidden_dim=config.get("hidden_dim", 256),
        num_layers=config.get("num_layers", 2),
        num_classes=num_classes,
        dropout=config.get("dropout", 0.3),
    )
    if architecture == "lstm":
        return LSTMClassifier(**common)
    elif architecture == "bilstm":
        return BiLSTMClassifier(**common)
    elif architecture == "cnn_lstm":
        return CNNLSTMClassifier(
            **common,
            num_filters=config.get("num_filters", 128),
            kernel_sizes=config.get("kernel_sizes", [3, 4, 5]),
        )
    else:
        raise ValueError(f"Unknown LSTM architecture: {architecture!r}")
