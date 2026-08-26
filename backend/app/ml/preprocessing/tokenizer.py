"""
NeuralText — LSTM Tokenizer
Vocabulary-based tokenizer fitted on training data only.
Follows strict train/fit → val+test/transform ordering to prevent data leakage.
"""
from __future__ import annotations

import json
import pickle
from collections import Counter
from pathlib import Path
from typing import Any, Optional

import numpy as np


class LSTMTokenizer:
    """
    Word-level tokenizer for LSTM models.
    
    CRITICAL ML RULE: fit() must only be called on training data.
    val/test data must use transform() only.
    """

    PAD_TOKEN = "<PAD>"
    UNK_TOKEN = "<UNK>"
    PAD_IDX = 0
    UNK_IDX = 1

    def __init__(
        self,
        max_vocab_size: int = 50_000,
        min_freq: int = 2,
        max_length: int = 256,
    ) -> None:
        self.max_vocab_size = max_vocab_size
        self.min_freq = min_freq
        self.max_length = max_length

        self.word2idx: dict[str, int] = {
            self.PAD_TOKEN: self.PAD_IDX,
            self.UNK_TOKEN: self.UNK_IDX,
        }
        self.idx2word: dict[int, str] = {
            self.PAD_IDX: self.PAD_TOKEN,
            self.UNK_IDX: self.UNK_TOKEN,
        }
        self.vocab_size: int = 2
        self._is_fitted: bool = False

    def fit(self, texts: list[str]) -> "LSTMTokenizer":
        """
        Build vocabulary from training texts only.
        Must never be called on validation or test data.
        """
        counter: Counter = Counter()
        for text in texts:
            tokens = self._tokenize(text)
            counter.update(tokens)

        # Filter by minimum frequency, sort by frequency descending
        vocab = [
            word
            for word, count in counter.most_common()
            if count >= self.min_freq
        ]
        # Truncate to max vocab size (minus 2 special tokens)
        vocab = vocab[: self.max_vocab_size - 2]

        for idx, word in enumerate(vocab, start=2):
            self.word2idx[word] = idx
            self.idx2word[idx] = word

        self.vocab_size = len(self.word2idx)
        self._is_fitted = True
        return self

    def transform(self, texts: list[str]) -> np.ndarray:
        """
        Convert texts to padded integer sequences.
        Uses UNK for out-of-vocabulary tokens.
        """
        if not self._is_fitted:
            raise RuntimeError("Tokenizer must be fitted before transform().")

        sequences = []
        for text in texts:
            tokens = self._tokenize(text)
            indices = [
                self.word2idx.get(tok, self.UNK_IDX)
                for tok in tokens[: self.max_length]
            ]
            # Pad to max_length
            padded = indices + [self.PAD_IDX] * (self.max_length - len(indices))
            sequences.append(padded)

        return np.array(sequences, dtype=np.int64)

    def fit_transform(self, texts: list[str]) -> np.ndarray:
        """Convenience method for training data only."""
        self.fit(texts)
        return self.transform(texts)

    def _tokenize(self, text: str) -> list[str]:
        """Simple whitespace tokenization."""
        return text.lower().split()

    def get_lengths(self, texts: list[str]) -> list[int]:
        """Return actual (pre-padding) sequence lengths."""
        return [
            min(len(self._tokenize(t)), self.max_length) for t in texts
        ]

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        with open(path / "tokenizer.pkl", "wb") as f:
            pickle.dump(
                {
                    "word2idx": self.word2idx,
                    "idx2word": self.idx2word,
                    "vocab_size": self.vocab_size,
                    "max_vocab_size": self.max_vocab_size,
                    "min_freq": self.min_freq,
                    "max_length": self.max_length,
                    "_is_fitted": self._is_fitted,
                },
                f,
            )

    @classmethod
    def load(cls, path: str | Path) -> "LSTMTokenizer":
        path = Path(path)
        with open(path / "tokenizer.pkl", "rb") as f:
            data = pickle.load(f)
        tok = cls(
            max_vocab_size=data["max_vocab_size"],
            min_freq=data["min_freq"],
            max_length=data["max_length"],
        )
        tok.word2idx = data["word2idx"]
        tok.idx2word = data["idx2word"]
        tok.vocab_size = data["vocab_size"]
        tok._is_fitted = data["_is_fitted"]
        return tok
