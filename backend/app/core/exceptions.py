"""
NeuralText — Custom Exception Hierarchy
Consistent structured error responses across the entire application.
"""
from __future__ import annotations

from typing import Any, Optional


class NeuralTextError(Exception):
    """Base exception for all application errors."""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str = "An unexpected error occurred.",
        error_code: Optional[str] = None,
        details: Optional[Any] = None,
    ) -> None:
        self.message = message
        self.error_code = error_code or self.__class__.error_code
        self.details = details
        super().__init__(message)


# ── 400 Bad Request ───────────────────────────────────────────────────────────
class ValidationError(NeuralTextError):
    status_code = 400
    error_code = "VALIDATION_ERROR"


class InvalidFileError(NeuralTextError):
    status_code = 400
    error_code = "INVALID_FILE"


class InvalidConfigError(NeuralTextError):
    status_code = 400
    error_code = "INVALID_CONFIG"


# ── 401 Unauthorized ──────────────────────────────────────────────────────────
class AuthenticationError(NeuralTextError):
    status_code = 401
    error_code = "AUTHENTICATION_FAILED"


class InvalidTokenError(NeuralTextError):
    status_code = 401
    error_code = "INVALID_TOKEN"


class TokenExpiredError(NeuralTextError):
    status_code = 401
    error_code = "TOKEN_EXPIRED"


# ── 403 Forbidden ─────────────────────────────────────────────────────────────
class PermissionDeniedError(NeuralTextError):
    status_code = 403
    error_code = "PERMISSION_DENIED"


# ── 404 Not Found ─────────────────────────────────────────────────────────────
class NotFoundError(NeuralTextError):
    status_code = 404
    error_code = "NOT_FOUND"


class UserNotFoundError(NotFoundError):
    error_code = "USER_NOT_FOUND"


class ProjectNotFoundError(NotFoundError):
    error_code = "PROJECT_NOT_FOUND"


class DatasetNotFoundError(NotFoundError):
    error_code = "DATASET_NOT_FOUND"


class ModelNotFoundError(NotFoundError):
    error_code = "MODEL_NOT_FOUND"


class JobNotFoundError(NotFoundError):
    error_code = "JOB_NOT_FOUND"


# ── 409 Conflict ──────────────────────────────────────────────────────────────
class ConflictError(NeuralTextError):
    status_code = 409
    error_code = "CONFLICT"


class EmailAlreadyExistsError(ConflictError):
    error_code = "EMAIL_ALREADY_EXISTS"


# ── 422 Unprocessable ─────────────────────────────────────────────────────────
class DatasetProcessingError(NeuralTextError):
    status_code = 422
    error_code = "DATASET_PROCESSING_ERROR"


# ── 429 Rate Limit ────────────────────────────────────────────────────────────
class RateLimitError(NeuralTextError):
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"


# ── 500 Internal ──────────────────────────────────────────────────────────────
class MLError(NeuralTextError):
    status_code = 500
    error_code = "ML_ERROR"


class TrainingError(MLError):
    error_code = "TRAINING_ERROR"


class InferenceError(MLError):
    error_code = "INFERENCE_ERROR"


class StorageError(NeuralTextError):
    status_code = 500
    error_code = "STORAGE_ERROR"
