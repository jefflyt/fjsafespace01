"""
backend/app/api/routers/reports.py

Report generation and lifecycle routes.

POST  /api/reports/generate
      Body: { uploadId, reportType }
      QA gate enforcement (QA-G4 through QA-G9) runs before any processing.
      Selects HTML template based on reportType (ASSESSMENT | INTERVENTION_IMPACT).
      Renders HTML → PDF via WeasyPrint.
      Stores PDF bytes in Report.pdfBinaryData (PostgreSQL bytea).

GET   /api/reports/{report_id}
PATCH /api/reports/{report_id}/status
GET   /api/reports/{report_id}/export  → PDF stream

Allowed reviewer status transitions:
  DRAFT_GENERATED → IN_REVIEW
  IN_REVIEW → REVISION_REQUIRED | APPROVED (Jay Choy only for cert outcomes)
  REVISION_REQUIRED → IN_REVIEW
  APPROVED → EXPORTED

Reference: TDD §4.5
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies import SessionDep
from app.models.enums import ReportType, ReviewerStatus

router = APIRouter()


class GenerateReportRequest(BaseModel):
    upload_id: str
    report_type: ReportType = ReportType.ASSESSMENT


class UpdateReportStatusRequest(BaseModel):
    reviewer_status: ReviewerStatus
    reviewer_name: str


@router.post("/reports/generate", status_code=status.HTTP_200_OK)
async def generate_report(body: GenerateReportRequest, session: SessionDep):
    """
    Enforce QA gates, select template, render PDF, store, return report summary.

    QA gates evaluated (fail fast on first violation):
    - QA-G4: dataQualityStatement present
    - QA-G5: all findings have ruleVersion + citationUnitIds
    - QA-G6: sourceCurrencyStatus CURRENT_VERIFIED or advisory label confirmed
    - QA-G7: certificationOutcome not null
    - QA-G8: reviewerName matches APPROVER_EMAIL for cert outcomes
    - QA-G9: tenant_id valid (Phase 3 only)

    Returns 422: { gate, message } on first gate failure.
    Returns 200: { reportId, reportType, status: DRAFT_GENERATED, previewUrl }
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/reports/{report_id}", status_code=status.HTTP_200_OK)
async def get_report(report_id: str, session: SessionDep):
    """
    Returns report metadata including reportType.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.patch("/reports/{report_id}/status", status_code=status.HTTP_200_OK)
async def update_report_status(
    report_id: str,
    body: UpdateReportStatusRequest,
    session: SessionDep,
):
    """
    Transitions reviewer status following allowed FSM.
    QA-G8 enforced: APPROVED transition requires reviewerName == APPROVER_EMAIL.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/reports/{report_id}/export", status_code=status.HTTP_200_OK)
async def export_report(report_id: str, session: SessionDep):
    """
    Streams PDF bytes from Report.pdfBinaryData (PostgreSQL bytea).
    Content-Type: application/pdf
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")
