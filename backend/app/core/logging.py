"""
NeuralText — Structured Logging
Request-scoped logging with trace IDs.
"""
from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any

import structlog

from app.core.config import settings

# Context var for request-scoped trace ID
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def add_request_id(logger: Any, method: str, event_dict: dict) -> dict:
    request_id = request_id_var.get("")
    if request_id:
        event_dict["request_id"] = request_id
    return event_dict


def configure_logging() -> None:
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            add_request_id,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
            if settings.ENVIRONMENT != "development"
            else structlog.dev.ConsoleRenderer(colors=True),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    return structlog.get_logger(name)
