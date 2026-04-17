"""
backend/app/services/pdf_generator.py

PDF generation service using WeasyPrint.

Selects the correct HTML template based on reportType:
  ASSESSMENT          → templates/assessment.html (current IAQ state framing)
  INTERVENTION_IMPACT → templates/intervention_impact.html (post-change framing)

PDF bytes are returned and stored in Report.pdfBinaryData (PostgreSQL bytea).
No external file storage is used.

Reference: TDD §4.5 (POST /api/reports/generate processing steps)
"""

from pathlib import Path

from app.models.enums import ReportType

# Template directory — relative to this file's package root
TEMPLATE_DIR = Path(__file__).parent / "templates"


def render_report_to_pdf(
    findings: list[dict],
    report_metadata: dict,
    report_type: ReportType,
) -> bytes:
    """
    Compose findings into an HTML report template and render to PDF via WeasyPrint.

    Args:
        findings:        List of finding dicts (from DB / EvaluatedFinding).
        report_metadata: Site name, reviewer name, report version, dates, etc.
        report_type:     Determines which HTML template is selected.

    Returns:
        PDF as raw bytes for storage in Report.pdfBinaryData.

    TODO (Phase 1 implementation):
    - Load HTML template for report_type
    - Render Jinja2 template with findings + metadata
    - Pass rendered HTML string to weasyprint.HTML(string=...).write_pdf()
    - Return bytes
    - Raise ValueError if WeasyPrint output is empty / invalid
    """
    raise NotImplementedError("pdf_generator.render_report_to_pdf — Phase 1 implementation pending")
