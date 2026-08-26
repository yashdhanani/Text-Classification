"""
NeuralText — FastAPI Application Entry Point
Production-ready with middleware, exception handlers, CORS, and OpenAPI docs.
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import NeuralTextError
from app.core.logging import configure_logging, get_logger, request_id_var

configure_logging()
logger = get_logger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("NeuralText API starting", version=settings.APP_VERSION, env=settings.ENVIRONMENT)

    # 1. Ensure all models are imported so Base.metadata contains all tables
    import app.models.user
    import app.models.project
    import app.models.dataset
    import app.models.ml_model
    import app.models.prediction
    import app.models.api_key
    import app.models.training_job

    # 2. Ensure DB tables exist
    from app.core.database import create_all_tables, AsyncSessionLocal
    try:
        await create_all_tables()
        logger.info("Database tables ensured")
    except Exception as e:
        logger.warning("Could not create tables", error=str(e))

    # 3. Ensure default admin user exists immediately (instant login)
    try:
        from sqlalchemy import select
        from app.models.user import User
        from app.core.security import hash_password
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(User).where(User.email == "admin@neuraltext.ai"))
            admin = res.scalar_one_or_none()
            if not admin:
                logger.info("Seeding default admin user...")
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
                await db.commit()
                logger.info("Default admin user created: admin@neuraltext.ai")
    except Exception as e:
        logger.warning("Could not ensure default admin user", error=str(e))

    # 4. Run full sample dataset/model seeding in background so port opens in milliseconds
    async def _bg_seed():
        try:
            import asyncio
            await asyncio.sleep(1)
            from scripts.seed_data import seed
            await seed()
            logger.info("Background database seeding completed")
        except Exception as e:
            logger.warning("Background seeding skipped or failed", error=str(e))

    import asyncio
    asyncio.create_task(_bg_seed())

    yield

    logger.info("NeuralText API shutting down")


# ── App Instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="World-class AI/NLP Text Classification Platform",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

@app.get("/api/v1/docs", include_in_schema=False)
async def api_v1_docs():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


@app.get("/api/v1/debug/db", tags=["System"])
async def debug_db(db: AsyncSession = Depends(get_db)):
    """Diagnostic endpoint to verify database connectivity on live deployments."""
    try:
        from sqlalchemy import text, select
        from app.models.user import User
        res = await db.execute(text("SELECT 1"))
        users = (await db.execute(select(User))).scalars().all()
        
        # Mask credentials in URL for safety
        db_str = str(settings.DATABASE_URL or "")
        masked = db_str.split("@")[-1] if "@" in db_str else "local/sqlite"
        return {
            "status": "connected",
            "host": masked,
            "test_query": res.scalar(),
            "user_count": len(users),
            "users": [u.email for u in users],
        }
    except Exception as e:
        logger.error("DB diagnostic failed", error=str(e))
        return {
            "status": "error",
            "error_type": type(e).__name__,
            "error_message": str(e),
        }

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.CORS_ORIGINS == ["*"] else settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request ID & Timing Middleware ────────────────────────────────────────────
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request_id_var.set(request_id)
    start = time.perf_counter()

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

    logger.info(
        "Request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    return response


# ── Exception Handlers ────────────────────────────────────────────────────────
@app.exception_handler(NeuralTextError)
async def neuraltext_error_handler(request: Request, exc: NeuralTextError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "request_id": request_id_var.get(""),
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": exc.errors(),
                "request_id": request_id_var.get(""),
            },
        },
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(exc),
                "type": type(exc).__name__,
                "request_id": request_id_var.get(""),
            },
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────
from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.training import router as training_router
from app.api.v1.models import router as models_router
from app.api.v1.predict import predict_router, api_keys_router, dashboard_router
from app.api.v1.batch import batch_router
from app.api.v1.admin import admin_router

prefix = settings.API_V1_PREFIX

app.include_router(auth_router, prefix=prefix)
app.include_router(projects_router, prefix=prefix)
app.include_router(datasets_router, prefix=prefix)
app.include_router(training_router, prefix=prefix)
app.include_router(models_router, prefix=prefix)
app.include_router(predict_router, prefix=prefix)
app.include_router(api_keys_router, prefix=prefix)
app.include_router(dashboard_router, prefix=prefix)
app.include_router(batch_router, prefix=prefix)
app.include_router(admin_router, prefix=prefix)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": f"{settings.API_V1_PREFIX}/docs",
    }
