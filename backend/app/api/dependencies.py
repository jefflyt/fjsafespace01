"""
backend/app/api/dependencies.py

FastAPI dependency providers.

R1-01: Supabase JWT extraction and tenant_id resolution.
- No Authorization header → returns None (FJ staff, backward compatible).
- Valid JWT with user_tenant mapping → returns tenant_id.
- Valid JWT without mapping → returns None (user exists but no tenant).
- Invalid/expired JWT → raises 401.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.core.config import settings
from app.database import get_session
from app.models.supporting import UserTenant

# ── Database session ──────────────────────────────────────────────────────────

SessionDep = Annotated[Session, Depends(get_session)]


# ── Supabase Auth ─────────────────────────────────────────────────────────────

def _decode_jwt(token: str) -> dict:
    """Decode and verify a Supabase JWT. Raises 401 on failure."""
    import jwt
    from jwt import PyJWTError

    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET not configured.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc

    return payload


def _extract_bearer_token(request: Request) -> str | None:
    """Extract Bearer token from Authorization header. Returns None if absent."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header[7:]


def get_tenant_id(
    request: Request,
    session: SessionDep,
) -> str | None:
    """
    Extract tenant_id from Supabase JWT in Authorization header.

    Returns:
        tenant_id if token is valid and user has a tenant mapping.
        None if no token (FJ staff) or user exists but has no tenant.

    Raises:
        401 if token is present but invalid/expired.
    """
    token = _extract_bearer_token(request)
    if token is None:
        return None

    payload = _decode_jwt(token)
    supabase_user_id = payload.get("sub")
    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim.",
        )

    user_tenant = session.exec(
        select(UserTenant).where(UserTenant.supabase_user_id == supabase_user_id)
    ).first()

    if user_tenant is None:
        return None

    return user_tenant.tenant_id


def get_current_tenant(
    request: Request,
    session: SessionDep,
) -> str:
    """
    Require a valid Supabase JWT and return the associated tenant_id.

    Raises:
        401 if no token, invalid token, or user has no tenant mapping.
    """
    token = _extract_bearer_token(request)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required.",
        )

    payload = _decode_jwt(token)
    supabase_user_id = payload.get("sub")
    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim.",
        )

    user_tenant = session.exec(
        select(UserTenant).where(UserTenant.supabase_user_id == supabase_user_id)
    ).first()

    if user_tenant is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User has no tenant assignment.",
        )

    return user_tenant.tenant_id


TenantIdDep = Annotated[str | None, Depends(get_tenant_id)]
RequiredTenantIdDep = Annotated[str, Depends(get_current_tenant)]
