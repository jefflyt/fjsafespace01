"""
backend/app/api/dependencies.py

FastAPI dependency providers.

Phase 1/2: No authentication — all routes are open (internal laptop only).
Phase 3:   Clerk JWT extraction and tenant_id validation will be added here.
           The placeholder `get_tenant_id` function is already wired to signal
           where the Phase 3 injection point lives.
"""

from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.database import get_session

# ── Database session ──────────────────────────────────────────────────────────

SessionDep = Annotated[Session, Depends(get_session)]


# ── Phase 3 auth stub ─────────────────────────────────────────────────────────

def get_tenant_id() -> str | None:
    """
    Phase 1/2: always returns None (no auth).
    Phase 3:   Replace with Clerk JWT extraction:
               - Verify Clerk session token from Authorization header.
               - Extract org_id → tenant_id.
               - Raise 401 if token missing / invalid.
               - Raise 403 if tenant_id mismatch on data request.
    """
    return None


TenantIdDep = Annotated[str | None, Depends(get_tenant_id)]
