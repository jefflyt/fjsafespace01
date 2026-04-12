"""
backend/app/api/routers/notifications.py

Notification routes.

GET   /api/notifications          Returns [Notification] for current user/tenant.
PATCH /api/notifications/{id}/read  Marks a notification as read.

Phase 1/2: returns all notifications (no auth scope).
Phase 3:   scoped to tenant_id from Clerk JWT.

Frontend polls this endpoint every 60 seconds (TDD §7.1).

Reference: TDD §4.7
"""

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import SessionDep, TenantIdDep

router = APIRouter()


@router.get("/notifications", status_code=status.HTTP_200_OK)
async def list_notifications(session: SessionDep, tenant_id: TenantIdDep):
    """
    Returns notifications for the current user.
    Phase 3: scoped to tenant from JWT.

    Fields: id, type, title, body, isRead, createdAt
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.patch("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK)
async def mark_notification_read(notification_id: str, session: SessionDep, tenant_id: TenantIdDep):
    """Mark a notification as read."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")
