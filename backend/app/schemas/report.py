"""
backend/app/schemas/report.py

Pydantic schemas for report API request/response payloads.
QA/approval schemas deferred to R3.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import CertificationOutcome, ReportType, ReviewerStatus


class CreateReportRequest(BaseModel):
    upload_id: str
    site_id: str
    report_type: ReportType = ReportType.ASSESSMENT
    rule_version_used: str = ""
    citation_ids_used: str = "[]"
    data_quality_statement: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    report_type: ReportType
    upload_id: str
    site_id: str
    report_version: int
    rule_version_used: str
    citation_ids_used: str
    reviewer_name: Optional[str] = None
    reviewer_status: ReviewerStatus
    reviewer_approved_at: Optional[datetime] = None
    qa_checks: str = "{}"
    data_quality_statement: Optional[str] = None
    certification_outcome: Optional[CertificationOutcome] = None
    report_snapshot: Optional[str] = None
    generated_at: datetime
