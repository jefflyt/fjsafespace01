"""
backend/app/main.py

FastAPI application entry point for FJDashboard backend.

Run locally:
    fastapi dev app/main.py      # hot-reload dev server on :8000

Production (Render):
    uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import (
    dashboard_router,
    notifications_router,
    reports_router,
    rulebook_router,
    uploads_router,
)

app = FastAPI(
    title="FJDashboard API",
    version="0.1.0",
    description=(
        "FJ SafeSpace Wellness Platform — backend API. "
        "Handles CSV parsing, rule evaluation, PDF report generation, "
        "and dashboard data aggregation."
    ),
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Phase 1/2: allow localhost:3000 (Next.js dev server)
# Phase 3:   restrict to Vercel production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(uploads_router, prefix="/api", tags=["uploads"])
app.include_router(dashboard_router, prefix="/api", tags=["dashboard"])
app.include_router(reports_router, prefix="/api", tags=["reports"])
app.include_router(rulebook_router, prefix="/api", tags=["rulebook"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])


@app.get("/health", tags=["health"])
async def health_check():
    """Basic liveness probe."""
    return {"status": "ok"}
