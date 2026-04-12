"""
backend/app/models/supporting.py

Supporting tables: Tenant (Phase 3) and Notification.

Reference: TDD §3.4
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Tenant(SQLModel, table=True):
    __tablename__ = "tenant"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    tenant_name: str
    contact_email: str
    certification_due_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(SQLModel, table=True):
    """
    In-app notifications.  Frontend polls GET /api/notifications every 60 seconds.
    Phase 3: also triggers Resend email for renewal_due events.

    Notification types:
      alert_new | alert_overdue | report_approved | renewal_due
    """

    __tablename__ = "notification"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    # null = broadcast to ops team
    user_id: Optional[str] = None
    # null for Phase 1/2
    tenant_id: Optional[str] = None
    type: str
    title: str
    body: str
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
