"""
backend/app/api/routers/reports.py

Report lifecycle routes.

POST   /api/reports                      — Create a draft report
GET    /api/reports                      — List all reports
GET    /api/reports/{report_id}          — Get report details
PATCH  /api/reports/{report_id}/qa-checklist — Save QA checklist progress
POST   /api/reports/{report_id}/approve  — Run QA gates, transition to approved
GET    /api/reports/{report_id}/export   — Stream PDF bytes

Allowed reviewer status transitions:
  DRAFT_GENERATED → IN_REVIEW
  IN_REVIEW → REVISION_REQUIRED | APPROVED (Jay Choy only for cert outcomes)
  REVISION_REQUIRED → IN_REVIEW
  APPROVED → EXPORTED

Reference: TDD §4.5
"""

import json
from datetime import datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlmodel import select

from app.api.dependencies import SessionDep
from app.models.enums import CertificationOutcome, ReviewerStatus
from app.models.workflow_b import Finding, Report, Upload
from app.schemas.report import (
    ApprovalResponse,
    ApproveReportRequest,
    CreateReportRequest,
    QAGateResponse,
    ReportResponse,
    UpdateQAChecklistRequest,
)
from app.services.pdf_orchestrator import generate_report_pdf
from app.services.qa_gates import can_approve_report

router = APIRouter(tags=["reports"])

# Allowed state transitions
ALLOWED_TRANSITIONS: dict[ReviewerStatus, list[ReviewerStatus]] = {
    ReviewerStatus.DRAFT_GENERATED: [ReviewerStatus.IN_REVIEW],
    ReviewerStatus.IN_REVIEW: [ReviewerStatus.REVISION_REQUIRED, ReviewerStatus.APPROVED],
    ReviewerStatus.REVISION_REQUIRED: [ReviewerStatus.IN_REVIEW],
    ReviewerStatus.APPROVED: [ReviewerStatus.EXPORTED],
    ReviewerStatus.EXPORTED: [],
}


def _report_to_response(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        report_type=report.report_type,
        upload_id=report.upload_id,
        site_id=report.site_id,
        report_version=report.report_version,
        rule_version_used=report.rule_version_used,
        citation_ids_used=report.citation_ids_used,
        reviewer_name=report.reviewer_name,
        reviewer_status=report.reviewer_status,
        reviewer_approved_at=report.reviewer_approved_at,
        qa_checks=report.qa_checks,
        data_quality_statement=report.data_quality_statement,
        certification_outcome=report.certification_outcome,
        pdf_url=report.pdf_url,
        generated_at=report.generated_at,
    )


@router.post("/reports", status_code=status.HTTP_201_CREATED)
async def create_report(body: CreateReportRequest, session: SessionDep):
    """
    Create a draft report linked to an upload.
    Validates that the upload exists and has findings.
    """
    # Verify upload exists
    upload = session.get(Upload, body.upload_id)
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")

    # Verify findings exist for this upload
    findings = session.exec(select(Finding).where(Finding.upload_id == body.upload_id)).all()
    if not findings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create report: no findings exist for this upload.",
        )

    # Determine certification outcome from findings
    certification_outcome = _determine_outcome(findings)

    report = Report(
        upload_id=body.upload_id,
        site_id=body.site_id,
        report_type=body.report_type,
        rule_version_used=body.rule_version_used,
        citation_ids_used=body.citation_ids_used,
        data_quality_statement=body.data_quality_statement,
        certification_outcome=certification_outcome,
        reviewer_status=ReviewerStatus.DRAFT_GENERATED,
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    return _report_to_response(report)


@router.get("/reports", status_code=status.HTTP_200_OK)
async def list_reports(session: SessionDep):
    """List all reports."""
    reports = session.exec(select(Report)).all()
    return [_report_to_response(r) for r in reports]


@router.get("/reports/{report_id}", status_code=status.HTTP_200_OK)
async def get_report(report_id: str, session: SessionDep):
    """Get report metadata including reportType."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    return _report_to_response(report)


@router.patch("/reports/{report_id}/qa-checklist", status_code=status.HTTP_200_OK)
async def update_qa_checklist(
    report_id: str,
    body: UpdateQAChecklistRequest,
    session: SessionDep,
):
    """
    Save QA checklist progress. Analysts can check off gates incrementally.
    Does NOT run automatic validation — this is purely for UI state persistence.
    """
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    report.qa_checks = json.dumps(body.qa_checks)
    if body.data_quality_statement is not None:
        report.data_quality_statement = body.data_quality_statement
    if body.reviewer_name is not None:
        report.reviewer_name = body.reviewer_name

    # Transition to IN_REVIEW if moving from DRAFT_GENERATED
    if report.reviewer_status == ReviewerStatus.DRAFT_GENERATED:
        report.reviewer_status = ReviewerStatus.IN_REVIEW

    session.add(report)
    session.commit()
    session.refresh(report)

    return _report_to_response(report)


@router.post("/reports/{report_id}/approve", status_code=status.HTTP_200_OK)
async def approve_report(
    report_id: str,
    body: ApproveReportRequest,
    session: SessionDep,
):
    """
    Run all QA gates. If all pass, transition to APPROVED.
    Returns 400 with gate details if any gate fails.
    QA-G8: reviewerName must match APPROVER_EMAIL for certification outcomes.
    """
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    # Check state transition is allowed
    if ReviewerStatus.APPROVED not in ALLOWED_TRANSITIONS.get(report.reviewer_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve from status {report.reviewer_status.value}.",
        )

    # Set reviewer name
    report.reviewer_name = body.reviewer_name

    # Get findings for this report's upload
    findings = session.exec(select(Finding).where(Finding.upload_id == report.upload_id)).all()

    # Run QA gates
    all_passed, qa_results = can_approve_report(report, findings)

    qa_response = [
        QAGateResponse(gate=r.gate, passed=r.passed, message=r.message) for r in qa_results
    ]

    if not all_passed:
        failed_gates = [r.gate for r in qa_results if not r.passed]
        return ApprovalResponse(
            success=False,
            report_id=report_id,
            reviewer_status=report.reviewer_status,
            qa_results=qa_response,
            error=f"QA gates failed: {', '.join(failed_gates)}",
        )

    # All gates passed — approve
    report.reviewer_status = ReviewerStatus.APPROVED
    report.reviewer_approved_at = datetime.utcnow()
    report.qa_checks = json.dumps({r.gate: True for r in qa_results})

    session.add(report)
    session.commit()
    session.refresh(report)

    return ApprovalResponse(
        success=True,
        report_id=report_id,
        reviewer_status=report.reviewer_status,
        qa_results=qa_response,
    )


@router.get("/reports/{report_id}/export", status_code=status.HTTP_200_OK)
async def export_report(report_id: str, session: SessionDep):
    """
    Streams PDF bytes from Report.pdf_url.
    Phase 1/2: returns metadata with PDF URL.
    Phase 5: streams actual PDF bytes via WeasyPrint.
    """
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if report.reviewer_status != ReviewerStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report must be approved before export.",
        )

    if not report.pdf_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not yet generated for this report.",
        )

    return {"pdf_url": report.pdf_url}


@router.get("/reports/{report_id}/pdf", status_code=status.HTTP_200_OK)
async def generate_report_pdf_endpoint(report_id: str, session: SessionDep):
    """
    Generate and stream a PDF report.
    Only approved reports can be generated.
    Returns PDF bytes directly for browser download.
    """
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if report.reviewer_status != ReviewerStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report must be approved before PDF generation.",
        )

    # Get site name
    site = session.get(Upload, report.upload_id)
    site_name = site.site_id if site else "Unknown Site"

    # Get findings for this report's upload
    findings = session.exec(select(Finding).where(Finding.upload_id == report.upload_id)).all()

    if not findings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No findings available for PDF generation.",
        )

    # Generate PDF
    pdf_bytes = generate_report_pdf(report, findings, site_name)

    # Update report with generation timestamp
    report.generated_at = __import__("datetime").datetime.utcnow()
    session.add(report)
    session.commit()

    filename = f"FJDashboard_Report_{report.id[:8]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


def _determine_outcome(findings: list[Finding]) -> CertificationOutcome:
    """
    Determine certification outcome based on findings.
    If no findings, return INSUFFICIENT_EVIDENCE.
    If any CRITICAL findings exist, return IMPROVEMENT_RECOMMENDED.
    Otherwise, return HEALTHY_WORKPLACE_CERTIFIED.
    """
    from app.models.enums import ThresholdBand

    if not findings:
        return CertificationOutcome.INSUFFICIENT_EVIDENCE

    has_critical = any(f.threshold_band == ThresholdBand.CRITICAL for f in findings)
    if has_critical:
        return CertificationOutcome.IMPROVEMENT_RECOMMENDED

    return CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED
