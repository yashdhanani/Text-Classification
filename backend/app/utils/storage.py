"""
NeuralText — Storage Abstraction (MinIO / S3 compatible)
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Optional

from minio import Minio
from minio.error import S3Error

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client: Optional[Minio] = None


def get_storage() -> Minio:
    global _client
    if _client is None:
        endpoint = settings.S3_ENDPOINT.replace("http://", "").replace("https://", "")
        _client = Minio(
            endpoint,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            secure=settings.S3_USE_SSL,
        )
        # Ensure buckets exist
        for bucket in [settings.S3_BUCKET_DATASETS, settings.S3_BUCKET_MODELS, settings.S3_BUCKET_REPORTS]:
            try:
                if not _client.bucket_exists(bucket):
                    _client.make_bucket(bucket)
                    logger.info("Created bucket", bucket=bucket)
            except Exception as e:
                logger.warning("Could not create bucket", bucket=bucket, error=str(e))
    return _client


def upload_file(bucket: str, object_name: str, file_path: str, content_type: str = "application/octet-stream") -> str:
    client = get_storage()
    client.fput_object(bucket, object_name, file_path, content_type=content_type)
    return f"{settings.S3_ENDPOINT}/{bucket}/{object_name}"


def download_file(bucket: str, object_name: str, dest_path: str) -> None:
    client = get_storage()
    client.fget_object(bucket, object_name, dest_path)


def upload_bytes(bucket: str, object_name: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    client = get_storage()
    client.put_object(bucket, object_name, io.BytesIO(data), len(data), content_type=content_type)
    return f"{settings.S3_ENDPOINT}/{bucket}/{object_name}"


def object_exists(bucket: str, object_name: str) -> bool:
    client = get_storage()
    try:
        client.stat_object(bucket, object_name)
        return True
    except S3Error:
        return False
