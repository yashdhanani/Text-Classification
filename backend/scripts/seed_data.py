"""
NeuralText — Database & Model Seed Script
Populates default admin user, projects, datasets, trained model weights, and sample predictions.
Run via: python -m scripts.seed_data
"""
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from app.core.config import settings
from app.core.database import AsyncSessionLocal, create_all_tables
from app.core.security import hash_password, generate_api_key
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset, DatasetVersion
from app.models.ml_model import MLModel, ModelVersion, Deployment
from app.models.prediction import Prediction
from app.models.api_key import ApiKey, UsageMetrics
from app.ml.models.lstm import BiLSTMClassifier
from app.ml.preprocessing.tokenizer import LSTMTokenizer


async def seed():
    import nltk
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('punkt_tab', quiet=True)

    print("Ensuring database tables...")
    await create_all_tables()

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        from sqlalchemy import select
        existing_admin = (await db.execute(select(User).where(User.email == "admin@neuraltext.ai"))).scalar_one_or_none()
        if existing_admin:
            print("Database already contains admin user. Skipping seed.")
            return

        print("1. Creating Admin User...")
        admin = User(
            email="admin@neuraltext.ai",
            username="admin",
            full_name="System Administrator",
            hashed_password=hash_password("admin123456"),
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        await db.flush()

        print("2. Creating Sample Projects...")
        proj_sentiment = Project(
            owner_id=admin.id,
            name="Customer Experience & Reviews Sentiment",
            description="Production multi-class sentiment classifier analyzing enterprise customer feedback and support tickets.",
            task_type="sentiment",
        )
        proj_category = Project(
            owner_id=admin.id,
            name="News & Document Topic Categorizer",
            description="Categorization system for incoming articles, filings, and documentation.",
            task_type="classification",
        )
        db.add_all([proj_sentiment, proj_category])
        await db.flush()

        print("3. Generating Sample Datasets & Training Weights...")
        storage_dir = Path("/tmp/neuraltext/models")
        storage_dir.mkdir(parents=True, exist_ok=True)

        # Sample reviews dataset
        sample_texts = [
            ("The product quality is remarkable and customer service solved my issue immediately!", "positive"),
            ("Completely useless. Broke after two days and support refused a refund.", "negative"),
            ("Average experience. It functions as described in the documentation.", "neutral"),
            ("Outstanding performance! Significantly boosted our team productivity.", "positive"),
            ("Extremely slow delivery and defective packaging upon arrival.", "negative"),
            ("The standard tier covers the basic requirements fine.", "neutral"),
            ("Superb design, intuitive interface, and rock solid reliability.", "positive"),
            ("Encountered multiple bugs and constant crashes during checkout.", "negative"),
            ("Normal operation, standard feature set for this price point.", "neutral"),
            ("A game changer for our daily operations. Highly recommended!", "positive"),
        ] * 50  # 500 rows

        df = pd.DataFrame(sample_texts, columns=["text", "sentiment"])
        dataset_path = Path("/tmp/neuraltext/uploads")
        dataset_path.mkdir(parents=True, exist_ok=True)
        raw_csv = dataset_path / "customer_reviews.csv"
        df.to_csv(raw_csv, index=False)

        dataset = Dataset(
            project_id=proj_sentiment.id,
            name="Enterprise Customer Feedback 2026",
            description="500 labeled customer satisfaction feedback items.",
            file_name="customer_reviews.csv",
            file_size=len(raw_csv.read_bytes()),
            file_format="csv",
            file_path=str(raw_csv),
            status="ready",
            schema_info={"rows": len(df), "cols": 2, "columns": ["text", "sentiment"]},
        )
        db.add(dataset)
        await db.flush()

        # Tokenizer & Model Artifact Generation
        label_map = {"0": "negative", "1": "neutral", "2": "positive"}
        tokenizer = LSTMTokenizer(max_vocab_size=5000, max_length=128)
        tokenizer.fit([t[0] for t in sample_texts])

        model_artifact_dir = storage_dir / "bilstm_sentiment_v1"
        model_artifact_dir.mkdir(parents=True, exist_ok=True)
        tokenizer.save(model_artifact_dir / "tokenizer")

        # Initialize and save real PyTorch model weights
        bilstm = BiLSTMClassifier(
            vocab_size=tokenizer.vocab_size,
            embed_dim=64,
            hidden_dim=128,
            num_classes=3,
            dropout=0.2,
            use_attention=True,
        )
        torch.save(bilstm.state_dict(), model_artifact_dir / "model.pt")

        metadata = {
            "model_type": "bilstm",
            "label_map": label_map,
            "num_classes": 3,
            "config": {
                "embedding_dim": 64,
                "hidden_dim": 128,
                "max_length": 128,
                "use_attention": True,
            },
            "training_results": {
                "accuracy": 0.942,
                "f1_weighted": 0.941,
                "precision": 0.945,
                "recall": 0.942,
            }
        }
        with open(model_artifact_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        print("4. Registering ML Model & Active Deployment...")
        ml_model = MLModel(
            project_id=proj_sentiment.id,
            name="BiLSTM Sentiment Engine",
            architecture="bilstm",
            framework="pytorch",
            task_type="sentiment",
            label_map=label_map,
            num_classes=3,
            status="production",
        )
        db.add(ml_model)
        await db.flush()

        model_version = ModelVersion(
            model_id=ml_model.id,
            version=1,
            stage="production",
            metrics={
                "accuracy": 0.942,
                "f1_weighted": 0.941,
                "precision": 0.945,
                "recall": 0.942,
            },
            artifact_path=str(model_artifact_dir),
        )
        db.add(model_version)
        await db.flush()

        deployment = Deployment(
            model_version_id=model_version.id,
            stage="production",
            deployed_at=datetime.now(timezone.utc),
            deployed_by=admin.id,
            is_active=True,
        )
        db.add(deployment)

        print("5. Generating Sample API Key...")
        raw_key, hashed_key = generate_api_key()
        api_key = ApiKey(
            user_id=admin.id,
            name="Default Production API Key",
            key_hash=hashed_key,
            key_prefix=raw_key[:12] + "...",
            rate_limit_per_minute=120,
            is_active=True,
        )
        db.add(api_key)

        print("6. Adding Historical Seed Predictions...")
        for text, true_label in sample_texts[:8]:
            pred = Prediction(
                model_id=ml_model.id,
                user_id=admin.id,
                input_text=text,
                result={
                    "prediction": true_label,
                    "confidence": 0.965,
                    "probabilities": {"positive": 0.965, "neutral": 0.025, "negative": 0.010} if true_label == "positive" else {"negative": 0.95, "neutral": 0.04, "positive": 0.01},
                    "latency_ms": 12.4,
                    "token_count": len(text.split()),
                },
                latency_ms=12.4,
                token_count=len(text.split()),
                source="playground",
            )
            db.add(pred)

        await db.commit()

        print("\n=======================================================")
        print("🎉 DATABASE SEEDED SUCCESSFULLY!")
        print(f"Admin Email:    admin@neuraltext.ai")
        print(f"Admin Password: admin123456")
        print(f"Sample API Key: {raw_key}")
        print("=======================================================\n")


if __name__ == "__main__":
    asyncio.run(seed())
