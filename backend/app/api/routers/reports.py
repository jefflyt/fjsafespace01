"""
backend/app/api/routers/reports.py

Report lifecycle routes (R1 — simplified, no QA/approval/PDF).

POST   /api/reports                      — Create a draft report
GET    /api/reports                      — List all reports
GET    /api/reports/{report_id}          — Get report details

Full QA gate, approval workflow, and PDF generation deferred to R3.
Reference: PSD-R1 §19 Phase R3
"""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.dependencies import SessionDep
from app.models.enums import CertificationOutcome
from app.models.workflow_b import Finding, Report, Upload
from app.schemas.report import CreateReportRequest, ReportResponse

router = APIRouter(tags=["reports"])


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
        report_snapshot=report.report_snapshot,
        generated_at=report.generated_at,
    )


def _determine_outcome(findings: list[Finding]) -> CertificationOutcome:
    from app.models.enums import ThresholdBand

    if not findings:
        return CertificationOutcome.INSUFFICIENT_EVIDENCE

    has_critical = any(f.threshold_band == ThresholdBand.CRITICAL for f in findings)
    if has_critical:
        return CertificationOutcome.IMPROVEMENT_RECOMMENDED

    return CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED


@router.post("/reports", status_code=status.HTTP_201_CREATED)
async def create_report(body: CreateReportRequest, session: SessionDep):
    """
    Create a draft report linked to an upload.
    Validates that the upload exists and has findings.
    """
    upload = session.get(Upload, body.upload_id)
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")

    findings = session.exec(select(Finding).where(Finding.upload_id == body.upload_id)).all()
    if not findings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create report: no findings exist for this upload.",
        )

    certification_outcome = _determine_outcome(findings)

    critical_count = sum(1 for f in findings if f.threshold_band.value == "CRITICAL")
    watch_count = sum(1 for f in findings if f.threshold_band.value == "WATCH")
    if critical_count > 0 or watch_count > 0:
        data_quality = f"{critical_count} critical, {watch_count} watch-band findings identified."
    else:
        data_quality = "All parameters within acceptable ranges during the sampling window."

    report = Report(
        upload_id=body.upload_id,
        site_id=body.site_id,
        report_type=body.report_type,
        rule_version_used=body.rule_version_used or "v1.0",
        citation_ids_used=body.citation_ids_used or "",
        data_quality_statement=body.data_quality_statement or data_quality,
        certification_outcome=certification_outcome,
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
    """Get report metadata."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    return _report_to_response(report)
