"""
backend/app/models/supporting.py

Supporting tables: Tenant, UserTenant (R1 auth), and Notification.

Reference: TDD §3.4, §3.6 (user_tenant)
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Column, Field, SQLModel
import sqlalchemy as sa
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import ARRAY


class Tenant(SQLModel, table=True):
    __tablename__ = "tenant"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    tenant_name: str
    contact_email: str
    certification_due_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # PR9: Customer information fields (nullable for backward compatibility)
    client_name: Optional[str] = Field(default=None)
    site_address: Optional[str] = Field(default=None)
    premises_type: Optional[str] = Field(default=None)
    contact_person: Optional[str] = Field(default=None)
    specific_event: Optional[str] = Field(default=None)
    comparative_analysis: bool = Field(default=False)


class UserTenant(SQLModel, table=True):
    """Maps Supabase Auth users to tenants with role-based access."""

    __tablename__ = "user_tenant"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    supabase_user_id: str = Field(unique=True, index=True)
    tenant_id: str = Field(foreign_key="tenant.id")
    # 'facility_manager' | 'admin'
    role: str = Field(default="facility_manager")
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
    tenant_id: Optional[str] = None
    type: str
    title: str
    body: str
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── R1-03: Site Metric Preferences & Standards ────────────────────────────────


class SiteMetricPreferences(SQLModel, table=True):
    """Per-site metric visibility and alert threshold customization."""

    __tablename__ = "site_metric_preferences"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    site_id: str = Field(foreign_key="site.id", unique=True, index=True)
    active_metrics: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(sa.Text())),
    )
    alert_threshold_overrides: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SiteStandards(SQLModel, table=True):
    """Links sites to their active certification standards."""

    __tablename__ = "site_standards"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    site_id: str = Field(foreign_key="site.id", index=True)
    reference_source_id: str = Field(foreign_key="reference_source.id")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
