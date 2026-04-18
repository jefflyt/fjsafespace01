"""
backend/app/schemas/report.py

Pydantic schemas for report API request/response payloads.
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
    pdf_url: Optional[str] = None
    generated_at: datetime


class UpdateQAChecklistRequest(BaseModel):
    qa_checks: dict[str, bool]
    data_quality_statement: Optional[str] = None
    reviewer_name: Optional[str] = None


class ApproveReportRequest(BaseModel):
    reviewer_name: str


class QAGateResponse(BaseModel):
    gate: str
    passed: bool
    message: str


class ApprovalResponse(BaseModel):
    success: bool
    report_id: str
    reviewer_status: ReviewerStatus
    qa_results: list[QAGateResponse]
    error: Optional[str] = None
