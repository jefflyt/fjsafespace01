"""
backend/app/schemas/upload.py

Pydantic schemas for upload requests/responses.
"""

from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator

UUIDStr = Annotated[str, BeforeValidator(str)]


class UploadRequest(BaseModel):
    """Upload request body — accepts tenant_id instead of individual customer fields."""
    tenant_id: Optional[UUIDStr] = None
    standards: Optional[list[str]] = None
    site_id: Optional[UUIDStr] = None


class UploadResponse(BaseModel):
    """Full upload response."""
    upload_id: UUIDStr
    file_name: str
    site_id: UUIDStr
    tenant_id: Optional[UUIDStr] = None
    parse_status: str
    parse_outcome: Optional[str] = None
    warnings: Optional[str] = None
    uploaded_at: str
    failed_row_count: int
    report_type: str
    finding_count: int
    wellness_score: float
    certification_outcome: str
    standards_evaluated: Optional[list[str]] = None
