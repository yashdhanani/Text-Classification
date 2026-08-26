"""
NeuralText — Core Configuration
Pydantic Settings with full environment variable support.
"""
from __future__ import annotations

import secrets
from functools import lru_cache
from typing import Any, List, Optional

from pydantic import AnyHttpUrl, PostgresDsn, RedisDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "NeuralText"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── API ──────────────────────────────────────────────────────────────────
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    SECRET_KEY: str = "neuraltext_dev_super_secret_jwt_key_987654321"
    JWT_SECRET_KEY: str = "neuraltext_dev_super_secret_jwt_key_987654321"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    @model_validator(mode="after")
    def sync_secret_keys(self) -> "Settings":
        if self.JWT_SECRET_KEY and self.JWT_SECRET_KEY != "neuraltext_dev_super_secret_jwt_key_987654321":
            self.SECRET_KEY = self.JWT_SECRET_KEY
        elif self.SECRET_KEY:
            self.JWT_SECRET_KEY = self.SECRET_KEY
        return self

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://neuraltext:neuraltext@localhost:5432/neuraltext"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    DATABASE_ECHO: bool = False

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    @field_validator("REDIS_URL", "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", mode="before")
    @classmethod
    def validate_redis_urls(cls, v: Any) -> str:
        val = str(v or "").strip()
        if not (val.startswith("redis://") or val.startswith("rediss://") or val.startswith("unix://")):
            return "redis://localhost:6379/0"
        return val

    # ── Object Storage (MinIO / S3) ───────────────────────────────────────────
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "neuraltext"
    S3_SECRET_KEY: str = "neuraltext123"
    S3_BUCKET_DATASETS: str = "datasets"
    S3_BUCKET_MODELS: str = "models"
    S3_BUCKET_REPORTS: str = "reports"
    S3_USE_SSL: bool = False

    # ── ML / Model Storage ───────────────────────────────────────────────────
    MODEL_STORAGE_PATH: str = "/app/storage/models"
    HUGGINGFACE_TOKEN: Optional[str] = None
    HUGGINGFACE_CACHE_DIR: str = "/app/storage/hf_cache"
    MAX_SEQUENCE_LENGTH: int = 512
    DEFAULT_BATCH_SIZE: int = 32

    # ── Email (SMTP) ─────────────────────────────────────────────────────────
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025  # MailHog default
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_TLS: bool = False
    EMAILS_FROM: str = "noreply@neuraltext.ai"

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 20

    # ── File Uploads ─────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 500
    ALLOWED_DATASET_EXTENSIONS: List[str] = [
        ".csv", ".json", ".jsonl", ".xlsx", ".xls", ".txt", ".parquet"
    ]

    # ── Monitoring ────────────────────────────────────────────────────────────
    PROMETHEUS_ENABLED: bool = True
    LOG_LEVEL: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
