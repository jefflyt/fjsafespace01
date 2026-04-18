"""
backend/app/skills/report-template-stylist/pdf_generator.py

PDF generation service using WeasyPrint.

Selects the correct HTML template based on reportType:
  ASSESSMENT          → templates/assessment_report.html
  INTERVENTION_IMPACT → templates/intervention_impact_report.html

Delegates to pdf_orchestrator for Jinja2 rendering and WeasyPrint compilation.

Reference: TDD §4.5 (POST /api/reports/generate processing steps)
"""

from app.models.enums import ReportType
from app.services.pdf_orchestrator import generate_report_pdf


def render_report_to_pdf(
    findings: list,
    report_metadata: dict,
    report_type: ReportType,
    site_name: str = "Unknown Site",
) -> bytes:
    """
    Compose findings into an HTML report template and render to PDF via WeasyPrint.

    Args:
        findings:        List of Finding SQLModel instances.
        report_metadata: Report SQLModel instance (passed as report_metadata for compatibility).
        report_type:     Determines which HTML template is selected.
        site_name:       Human-readable site name for the report header.

    Returns:
        PDF as raw bytes.

    Raises:
        ValueError: If WeasyPrint output is empty or invalid.
    """
    # report_metadata is expected to be the Report model instance
    report = report_metadata

    # Override report_type on the report instance to ensure template selection matches
    if hasattr(report, "report_type"):
        report.report_type = report_type

    pdf_bytes = generate_report_pdf(report, findings, site_name)

    if not pdf_bytes or len(pdf_bytes) < 100:
        raise ValueError("WeasyPrint generated empty or invalid PDF output.")

    return pdf_bytes
