"""
backend/app/schemas/tenant.py

Pydantic schemas for tenant/customer management.
"""

from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator

UUIDStr = Annotated[str, BeforeValidator(str)]


class TenantCreate(BaseModel):
    """Create a new tenant — minimal: client_name + contact_email."""
    client_name: str
    contact_email: str
    contact_person: Optional[str] = None
    site_address: Optional[str] = None
    premises_type: Optional[str] = None


class TenantUpdate(BaseModel):
    """Update tenant fields — all optional."""
    client_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_person: Optional[str] = None
    site_address: Optional[str] = None
    premises_type: Optional[str] = None
    specific_event: Optional[str] = None
    comparative_analysis: Optional[bool] = None


class TenantSearchResult(BaseModel):
    """Search result with match info."""
    id: UUIDStr
    client_name: str
    site_address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: str
    match_score: float


class TenantSummary(BaseModel):
    """List response with scan counts."""
    id: UUIDStr
    client_name: str
    site_address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: str
    scan_count: int
    site_count: int
    created_at: str


class TenantDetail(BaseModel):
    """Tenant details with upload history."""
    id: UUIDStr
    client_name: str
    site_address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: str
    premises_type: Optional[str] = None
    specific_event: Optional[str] = None
    comparative_analysis: bool
    scan_count: int
    site_count: int
    created_at: str
    uploads: list[dict] = []
