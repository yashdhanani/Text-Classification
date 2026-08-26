<div align="center">

# 🧠 NeuralText

### AI-Powered Text Classification Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?style=flat-square&logo=pytorch)](https://pytorch.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**Upload your dataset → Train a BiLSTM model → Get predictions via REST API**

[🚀 Quick Start](#-quick-start) • [📸 Screenshots](#-screenshots) • [🛠️ Tech Stack](#️-tech-stack) • [📡 API Docs](#-api-docs) • [☕ Support](#-support)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Dataset Management** | Upload CSV/JSON/Excel, auto-detect columns, preview & split stratified 70/15/15 |
| 🧠 **Model Training** | BiLSTM with real-time progress, accuracy & F1 metrics per epoch |
| 🔮 **Live Predictions** | Single-text playground with confidence scores & word-level explanations |
| 📦 **Batch Inference** | Classify thousands of texts in one API call |
| 📈 **Evaluation** | Full test-split evaluation with confusion matrix & classification report |
| 🔬 **Experiments** | Compare multiple model runs side-by-side |
| 🔑 **API Keys** | Generate keys for external app integration |
| 🛡️ **Admin Panel** | User management, system stats, DB size monitoring |
| 🎨 **Beautiful UI** | Dark-mode dashboard with smooth animations |

---

## 🚀 Quick Start

### Option 1 — Docker Compose (Recommended, one command)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/neuraltext.git
cd neuraltext

# Start everything (PostgreSQL + Redis + Backend + Frontend)
docker compose up --build

# Open in browser
open http://localhost:3000
```

> ⏳ First build takes ~5 minutes (downloads PyTorch). Subsequent starts are instant.

**Default login:** `admin@neuraltext.ai` / `admin123456`

---

### Option 2 — Run Locally (Development)

#### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

#### Backend
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your PostgreSQL and Redis credentials

# Run migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Set environment variable
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start dev server
npm run dev
```

Open **http://localhost:3000** → Login with `admin@neuraltext.ai` / `admin123456`

---

## 📸 Screenshots

> Dashboard → Datasets → Training → Predictions → Batch Jobs

| Dashboard | Training | Predictions |
|-----------|----------|-------------|
| Real-time stats | Live epoch progress | Confidence + explanations |

---

## 🛠️ Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| API | FastAPI + Uvicorn |
| ML | PyTorch BiLSTM |
| Database | PostgreSQL + SQLAlchemy (async + sync) |
| Cache / Queue | Redis |
| Auth | JWT (python-jose) |
| Background Jobs | Celery (optional) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Animations | Framer Motion |
| State | React Query + Zustand |
| Charts | Recharts |

---

## 📡 API Docs

Once running, interactive Swagger UI is available at:

```
http://localhost:8000/docs
```

### Quick API Examples

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@neuraltext.ai","password":"admin123456"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Single prediction
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model_id":"My Model","text":"Apple reports record revenue","include_explanation":true}'

# Batch prediction (using API key)
curl -X POST http://localhost:8000/api/v1/batch/predict \
  -H "X-API-Key: nt_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model_id":"My Model","texts":["text 1","text 2","text 3"]}'
```

```python
# Python SDK style
import requests

API_KEY = "nt_live_your_key_here"

result = requests.post("http://localhost:8000/api/v1/predict",
    headers={"X-API-Key": API_KEY},
    json={"model_id": "My Model", "text": "Your text here"}
).json()

print(result["prediction"])  # → "Business"
print(result["confidence"])  # → 0.87
```

---

## 🗂️ Project Structure

```
neuraltext/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST API endpoints
│   │   ├── core/            # Config, DB, logging
│   │   ├── ml/              # BiLSTM, training, inference
│   │   ├── models/          # SQLAlchemy ORM models
│   │   └── workers/         # Background task workers
│   ├── alembic/             # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # UI components
│   │   └── lib/             # API client, utilities
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml        # One-command full stack
└── README.md
```

---

## 🔄 End-to-End Workflow

```
1. Create Project  →  2. Upload Dataset  →  3. Split (70/15/15)
       ↓                                           ↓
7. Use API Key  ←  6. Batch Jobs  ←  5. Predict  ←  4. Train Model
```

### Supported Dataset Formats
- CSV (`.csv`)
- JSON / JSONL (`.json`, `.jsonl`)
- Excel (`.xlsx`, `.xls`)
- Parquet (`.parquet`)

---

## 🚢 Deploy to Production

### Railway (Easiest)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Render
1. Fork this repo
2. Go to [render.com](https://render.com) → New → Docker
3. Connect your GitHub repo
4. Set environment variables (see `backend/.env.example`)

### VPS (DigitalOcean / AWS / GCP)
```bash
# On your server
git clone https://github.com/YOUR_USERNAME/neuraltext.git
cd neuraltext

# Set production env vars
cp backend/.env.example backend/.env
nano backend/.env  # Edit secrets

# Deploy
docker compose -f docker-compose.yml up -d --build
```

---

## 🧪 Run Tests

```bash
# Run the full end-to-end test suite
# (requires backend running on localhost:8000)
python3 deep_test.py

# Expected: 36/36 PASSED
```

---

## 📄 Environment Variables

Create `backend/.env`:

```env
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/neuraltext_db
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=your-super-secret-key-change-this
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## ☕ Support

If this project helped you, consider buying me a coffee!

<a href="https://www.buymeacoffee.com/dhananiyash" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50px">
</a>

---

## 📜 License

MIT © 2024 [Yash Dhanani](https://github.com/dhananiyash)

---

<div align="center">
  <sub>Built with ❤️ using FastAPI + Next.js + PyTorch</sub>
</div>
