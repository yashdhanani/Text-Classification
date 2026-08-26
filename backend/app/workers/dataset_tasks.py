"""
NeuralText — Dataset Processing Celery Task
Validates, analyzes, and splits uploaded datasets.
"""
from __future__ import annotations

import json
from pathlib import Path

import json
from pathlib import Path
import html as _html_std
import re

import pandas as pd
import numpy as np
import redis
from sklearn.model_selection import train_test_split

from app.workers.celery_app import celery_app
from app.core.config import settings
from app.core.logging import get_logger


def _fix_html_entities(s: str) -> str:
    """Decode HTML entities including ones missing their leading &.

    The AG News corpus (and many web-scraped datasets) strips the & from
    HTML entities, leaving strings like  #39;  instead of  &#39;  (').
    We restore the & before numeric entities and common named entities,
    then run the standard unescape.
    """
    if not s or s == "nan":
        return s
    # Restore & before bare numeric entities:  #NNN;  →  &#NNN;
    s = re.sub(r'(?<!&)#(\d+);', r'&#\1;', s)
    # Restore & before bare named entities: amp; lt; gt; quot; apos;
    s = re.sub(r'(?<!&)(amp|lt|gt|quot|apos|nbsp);', r'&\1;', s)
    return _html_std.unescape(s)

logger = get_logger(__name__)
_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)


@celery_app.task(bind=True, name="app.workers.dataset_tasks.process_dataset")
def process_dataset(self, dataset_id: str, file_path: str, config: dict) -> dict:
    """
    Process and analyze an uploaded dataset.
    Returns schema info, statistics, and quality report.
    """
    try:
        _redis.setex(f"dataset:{dataset_id}", 3600, json.dumps({"status": "processing"}))

        # Load dataset
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext == ".csv":
            df = pd.read_csv(file_path)
        elif ext in (".json",):
            df = pd.read_json(file_path)
        elif ext == ".jsonl":
            df = pd.read_json(file_path, lines=True)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(file_path)
        elif ext == ".parquet":
            df = pd.read_parquet(file_path)
        elif ext == ".txt":
            df = pd.read_csv(file_path, sep="\n", header=None, names=["text"])
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        # Decode HTML entities in all string columns
        # (AG News stores #39; bare without &, so we need regex-based fix)
        for col in df.select_dtypes(include="object").columns:
            df[col] = df[col].astype(str).apply(_fix_html_entities)

        # ── Schema Detection ─────────────────────────────────────────────────
        schema = {
            "columns": list(df.columns),
            "dtypes": {col: str(df[col].dtype) for col in df.columns},
            "shape": {"rows": len(df), "cols": len(df.columns)},
        }

        # ── Quality Statistics ────────────────────────────────────────────────
        stats = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "missing_values": {col: int(df[col].isna().sum()) for col in df.columns},
            "duplicate_rows": int(df.duplicated().sum()),
            "column_stats": {},
        }

        # Per-column stats
        for col in df.columns:
            col_data = df[col].dropna()
            col_stat: dict = {"dtype": str(df[col].dtype), "missing": int(df[col].isna().sum())}

            if pd.api.types.is_numeric_dtype(df[col]):
                col_stat["min"] = float(col_data.min()) if len(col_data) > 0 else None
                col_stat["max"] = float(col_data.max()) if len(col_data) > 0 else None
                col_stat["mean"] = float(col_data.mean()) if len(col_data) > 0 else None
            else:
                col_stat["unique_values"] = int(df[col].nunique())
                # Text stats for string columns
                lengths = col_data.astype(str).apply(len)
                col_stat["avg_length"] = float(lengths.mean()) if len(lengths) > 0 else 0
                col_stat["min_length"] = int(lengths.min()) if len(lengths) > 0 else 0
                col_stat["max_length"] = int(lengths.max()) if len(lengths) > 0 else 0
                if col_data.nunique() <= 50:
                    col_stat["value_counts"] = col_data.value_counts().head(20).to_dict()

            stats["column_stats"][col] = col_stat

        result = {
            "status": "ready",
            "dataset_id": dataset_id,
            "schema": schema,
            "stats": stats,
        }

        _redis.setex(f"dataset:{dataset_id}", 3600, json.dumps(result))

        # Update DB status using synchronous session (safe from threads/subprocesses)
        try:
            import uuid as _uuid
            from sqlalchemy import update as _update
            from app.core.database import SyncSessionLocal
            from app.models.dataset import Dataset

            with SyncSessionLocal() as session:
                session.execute(
                    _update(Dataset)
                    .where(Dataset.id == _uuid.UUID(dataset_id))
                    .values(status="ready", schema_info=schema)
                )
                session.commit()
        except Exception as db_err:
            logger.warning("Could not update dataset status in DB", error=str(db_err))

        return result

    except Exception as exc:
        logger.error("Dataset processing failed", dataset_id=dataset_id, error=str(exc))
        _redis.setex(f"dataset:{dataset_id}", 3600, json.dumps({"status": "error", "error": str(exc)}))
        raise


@celery_app.task(bind=True, name="app.workers.dataset_tasks.split_dataset")
def split_dataset(self, dataset_version_id: str, file_path: str, config: dict) -> dict:
    """
    Stratified train/val/test split.
    config: {text_col, label_col, train_ratio, val_ratio, test_ratio, seed, output_dir}
    """
    df = _load_dataframe(file_path)

    text_col = config["text_col"]
    label_col = config["label_col"]
    train_r = config.get("train_ratio", 0.7)
    val_r = config.get("val_ratio", 0.15)
    test_r = config.get("test_ratio", 0.15)
    seed = config.get("seed", 42)
    output_dir = Path(config["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    # Drop rows missing text or label
    df = df.dropna(subset=[text_col, label_col]).reset_index(drop=True)

    # Encode labels as integers
    unique_labels = sorted(df[label_col].unique().tolist())
    label_to_int = {lbl: i for i, lbl in enumerate(unique_labels)}
    df["_label_int"] = df[label_col].map(label_to_int)
    label_map = {str(v): str(k) for k, v in label_to_int.items()}

    # Stratified split: first split out test, then split remainder into train/val
    temp_r = val_r + test_r
    X = df[[text_col, "_label_int"]]
    y = df["_label_int"]

    try:
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=temp_r, stratify=y, random_state=seed
        )
        val_share = val_r / temp_r
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=(1 - val_share), stratify=y_temp, random_state=seed
        )
    except ValueError:
        # Fall back to non-stratified if a class has too few samples
        X_train, X_temp = train_test_split(X, test_size=temp_r, random_state=seed)
        X_val, X_test = train_test_split(X_temp, test_size=(1 - val_r / temp_r), random_state=seed)

    def save_split(df_split, name: str) -> str:
        out_path = str(output_dir / f"{name}.parquet")
        df_split.to_parquet(out_path, index=False)
        return out_path

    train_path = save_split(X_train, "train")
    val_path = save_split(X_val, "val")
    test_path = save_split(X_test, "test")

    res = {
        "train_path": train_path,
        "val_path": val_path,
        "test_path": test_path,
        "label_map": label_map,
        "stats": {
            "total": len(df),
            "train": len(X_train),
            "val": len(X_val),
            "test": len(X_test),
            "num_classes": len(unique_labels),
            "classes": unique_labels,
            "distribution": {
                split: dict(zip(
                    [label_map[str(k)] for k in sorted(grp["_label_int"].unique())],
                    grp["_label_int"].value_counts().sort_index().values.tolist()
                ))
                for split, grp in [("train", X_train), ("val", X_val), ("test", X_test)]
            }
        },
    }

    # Update DB using synchronous session (safe from threads/subprocesses)
    try:
        import uuid as _uuid
        from sqlalchemy import update as _update
        from app.core.database import SyncSessionLocal
        from app.models.dataset import DatasetVersion

        with SyncSessionLocal() as session:
            session.execute(
                _update(DatasetVersion)
                .where(DatasetVersion.id == _uuid.UUID(dataset_version_id))
                .values(
                    train_path=train_path,
                    val_path=val_path,
                    test_path=test_path,
                    stats=res["stats"],
                )
            )
            session.commit()
    except Exception as db_err:
        logger.warning("Could not update dataset version in DB", error=str(db_err))

    return res


def _load_dataframe(file_path: str) -> pd.DataFrame:
    ext = Path(file_path).suffix.lower()
    loaders = {
        ".csv": pd.read_csv,
        ".json": pd.read_json,
        ".parquet": pd.read_parquet,
        ".xlsx": pd.read_excel,
        ".xls": pd.read_excel,
    }
    loader = loaders.get(ext, pd.read_csv)
    return loader(file_path)
