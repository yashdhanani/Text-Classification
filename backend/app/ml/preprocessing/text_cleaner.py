"""
NeuralText — Text Preprocessing Pipeline
Configurable preprocessing with model-specific handling.
Transformer models get minimal preprocessing; LSTM models get full cleaning.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Optional

import ftfy
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize

# Download required NLTK data on first import
_NLTK_DOWNLOADED = False


def _ensure_nltk_data() -> None:
    global _NLTK_DOWNLOADED
    if _NLTK_DOWNLOADED:
        return
    for resource in ["punkt", "stopwords", "punkt_tab"]:
        try:
            nltk.data.find(f"tokenizers/{resource}")
        except LookupError:
            try:
                nltk.download(resource, quiet=True)
            except Exception:
                pass
    _NLTK_DOWNLOADED = True


# ── Regex patterns (compiled once at module load) ─────────────────────────────
_URL_PATTERN = re.compile(
    r"https?://\S+|www\.\S+|ftp://\S+",
    re.IGNORECASE,
)
_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
_MENTION_PATTERN = re.compile(r"@\w+")
_HASHTAG_PATTERN = re.compile(r"#\w+")
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
_EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "]+",
    flags=re.UNICODE,
)
_WHITESPACE_PATTERN = re.compile(r"\s+")
_REPEATED_CHARS_PATTERN = re.compile(r"(.)\1{3,}")


class PreprocessingConfig:
    """Configurable preprocessing options."""

    def __init__(
        self,
        lowercase: bool = True,
        fix_encoding: bool = True,
        normalize_unicode: bool = True,
        remove_html: bool = True,
        replace_urls: bool = True,
        replace_emails: bool = True,
        replace_mentions: bool = False,
        replace_hashtags: bool = False,
        handle_emojis: str = "remove",  # remove | replace | keep
        remove_stopwords: bool = False,
        normalize_repeated_chars: bool = True,
        max_length: Optional[int] = None,
        language: str = "english",
    ) -> None:
        self.lowercase = lowercase
        self.fix_encoding = fix_encoding
        self.normalize_unicode = normalize_unicode
        self.remove_html = remove_html
        self.replace_urls = replace_urls
        self.replace_emails = replace_emails
        self.replace_mentions = replace_mentions
        self.replace_hashtags = replace_hashtags
        self.handle_emojis = handle_emojis
        self.remove_stopwords = remove_stopwords
        self.normalize_repeated_chars = normalize_repeated_chars
        self.max_length = max_length
        self.language = language

    @classmethod
    def for_lstm(cls) -> "PreprocessingConfig":
        """Recommended preprocessing for LSTM-based models."""
        return cls(
            lowercase=True,
            fix_encoding=True,
            normalize_unicode=True,
            remove_html=True,
            replace_urls=True,
            replace_emails=True,
            handle_emojis="replace",
            remove_stopwords=False,
            normalize_repeated_chars=True,
        )

    @classmethod
    def for_transformer(cls) -> "PreprocessingConfig":
        """
        Minimal preprocessing for transformer models.
        Transformers have their own tokenizers that handle most normalization.
        """
        return cls(
            lowercase=False,  # Transformers use cased tokenizers
            fix_encoding=True,
            normalize_unicode=True,
            remove_html=True,
            replace_urls=False,  # Keep URLs — BERT handles them
            replace_emails=False,
            handle_emojis="keep",
            remove_stopwords=False,
            normalize_repeated_chars=False,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "lowercase": self.lowercase,
            "fix_encoding": self.fix_encoding,
            "normalize_unicode": self.normalize_unicode,
            "remove_html": self.remove_html,
            "replace_urls": self.replace_urls,
            "replace_emails": self.replace_emails,
            "replace_mentions": self.replace_mentions,
            "replace_hashtags": self.replace_hashtags,
            "handle_emojis": self.handle_emojis,
            "remove_stopwords": self.remove_stopwords,
            "normalize_repeated_chars": self.normalize_repeated_chars,
            "max_length": self.max_length,
            "language": self.language,
        }


class TextPreprocessor:
    """
    Stateless text preprocessing pipeline.
    All transformations are deterministic and reproducible.
    """

    def __init__(self, config: Optional[PreprocessingConfig] = None) -> None:
        self.config = config or PreprocessingConfig()
        _ensure_nltk_data()
        self._stop_words: Optional[set[str]] = None

    @property
    def stop_words(self) -> set[str]:
        if self._stop_words is None:
            try:
                self._stop_words = set(stopwords.words(self.config.language))
            except Exception:
                self._stop_words = set()
        return self._stop_words

    def clean(self, text: str) -> str:
        """Apply the full preprocessing pipeline to a single text."""
        if not text or not isinstance(text, str):
            return ""

        # 1. Fix encoding artifacts (ftfy)
        if self.config.fix_encoding:
            try:
                text = ftfy.fix_text(text)
            except Exception:
                pass

        # 2. Unicode normalization
        if self.config.normalize_unicode:
            text = unicodedata.normalize("NFC", text)

        # 3. Remove HTML tags
        if self.config.remove_html:
            text = _HTML_TAG_PATTERN.sub(" ", text)

        # 4. Handle emojis
        if self.config.handle_emojis == "remove":
            text = _EMOJI_PATTERN.sub("", text)
        elif self.config.handle_emojis == "replace":
            text = _EMOJI_PATTERN.sub(" <EMOJI> ", text)

        # 5. Replace URLs
        if self.config.replace_urls:
            text = _URL_PATTERN.sub(" <URL> ", text)

        # 6. Replace emails
        if self.config.replace_emails:
            text = _EMAIL_PATTERN.sub(" <EMAIL> ", text)

        # 7. Replace mentions
        if self.config.replace_mentions:
            text = _MENTION_PATTERN.sub(" <MENTION> ", text)

        # 8. Replace hashtags
        if self.config.replace_hashtags:
            text = _HASHTAG_PATTERN.sub(" <HASHTAG> ", text)

        # 9. Normalize repeated characters: "loooove" → "loove"
        if self.config.normalize_repeated_chars:
            text = _REPEATED_CHARS_PATTERN.sub(r"\1\1", text)

        # 10. Lowercase
        if self.config.lowercase:
            text = text.lower()

        # 11. Remove stopwords (optional — generally not recommended for sentiment)
        if self.config.remove_stopwords:
            tokens = text.split()
            text = " ".join(t for t in tokens if t not in self.stop_words)

        # 12. Collapse whitespace
        text = _WHITESPACE_PATTERN.sub(" ", text).strip()

        # 13. Truncate to max_length (characters, not tokens)
        if self.config.max_length and len(text) > self.config.max_length:
            text = text[: self.config.max_length]

        return text

    def clean_batch(self, texts: list[str]) -> list[str]:
        return [self.clean(t) for t in texts]

    def get_stats(self, text: str) -> dict[str, Any]:
        """Return text statistics before/after preprocessing."""
        cleaned = self.clean(text)
        return {
            "original_length": len(text),
            "cleaned_length": len(cleaned),
            "word_count": len(cleaned.split()),
            "sentence_count": len(sent_tokenize(cleaned)) if cleaned else 0,
        }
