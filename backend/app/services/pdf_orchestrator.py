"""
backend/app/services/pdf_orchestrator.py

WeasyPrint PDF generation engine for FJDashboard reports.

Provides:
- Jinja2 template environment configured for the backend/templates/ directory.
- render_pdf() — compiles a named template + context into PDF bytes.
- generate_report_pdf() — hydrates a Report model with findings and renders
  the correct PDF template (assessment or intervention impact).
"""

import json
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from app.models.enums import ReportType, ThresholdBand

# Resolve templates directory relative to this file's location
_TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates"

jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=True,
)


def render_pdf(template_name: str, context: dict | None = None) -> bytes:
    """
    Render a Jinja2 template into PDF bytes using WeasyPrint.

    Args:
        template_name: Path relative to templates/ (e.g. "base.html").
        context: Variables injected into the Jinja2 template.

    Returns:
        Raw PDF bytes ready for streaming or file save.
    """
    template = jinja_env.get_template(template_name)
    html_string = template.render(context or {})
    pdf_bytes = HTML(string=html_string, base_url=str(_TEMPLATE_DIR)).write_pdf()
    return pdf_bytes


def _finding_to_dict(finding) -> dict:
    """Convert a Finding SQLModel instance to a renderable dict."""
    return {
        "id": finding.id,
        "metric_name": finding.metric_name.value if hasattr(finding.metric_name, "value") else finding.metric_name,
        "threshold_band": finding.threshold_band.value if hasattr(finding.threshold_band, "value") else finding.threshold_band,
        "zone_name": finding.zone_name,
        "interpretation_text": finding.interpretation_text,
        "workforce_impact_text": finding.workforce_impact_text,
        "recommended_action": finding.recommended_action,
        "rule_id": finding.rule_id,
        "rule_version": finding.rule_version,
        "citation_unit_ids": finding.citation_unit_ids,
        "confidence_level": finding.confidence_level.value if hasattr(finding.confidence_level, "value") else finding.confidence_level,
        "source_currency_status": finding.source_currency_status.value if hasattr(finding.source_currency_status, "value") else finding.source_currency_status,
        "benchmark_lane": finding.benchmark_lane.value if hasattr(finding.benchmark_lane, "value") else finding.benchmark_lane,
    }


def generate_report_pdf(
    report,
    findings: list,
    site_name: str = "Unknown Site",
) -> bytes:
    """
    Generate a PDF report from a Report model and its findings.

    Selects the correct HTML template based on report.report_type:
      ASSESSMENT          → assessment_report.html
      INTERVENTION_IMPACT → intervention_impact_report.html

    Args:
        report: Report SQLModel instance.
        findings: List of Finding SQLModel instances.
        site_name: Human-readable site name.

    Returns:
        PDF bytes.
    """
    # Determine template
    report_type = report.report_type
    if isinstance(report_type, ReportType):
        report_type = report_type.value

    template_map = {
        ReportType.ASSESSMENT.value: "assessment_report.html",
        ReportType.INTERVENTION_IMPACT.value: "intervention_impact_report.html",
    }
    template_name = template_map.get(report_type, "assessment_report.html")

    # Parse QA checks
    qa_checks = {}
    if report.qa_checks:
        try:
            qa_checks = json.loads(report.qa_checks)
        except (json.JSONDecodeError, TypeError):
            qa_checks = {}

    # Count critical findings
    critical_count = sum(
        1 for f in findings
        if f.threshold_band == ThresholdBand.CRITICAL
    )

    # Sort findings: CRITICAL first, then WATCH, then GOOD
    band_order = {
        ThresholdBand.CRITICAL: 0,
        ThresholdBand.WATCH: 1,
        ThresholdBand.GOOD: 2,
    }
    sorted_findings = sorted(
        findings,
        key=lambda f: band_order.get(f.threshold_band, 99),
    )
    # Top 3 findings by severity
    top_findings_data = [_finding_to_dict(f) for f in sorted_findings[:3]]

    # Format date for display
    generated_at = report.generated_at
    if isinstance(generated_at, datetime):
        generated_date_str = generated_at.strftime("%B %d, %Y")
    else:
        generated_date_str = str(generated_at)

    reviewer_approved_at = None
    if report.reviewer_approved_at:
        if isinstance(report.reviewer_approved_at, datetime):
            reviewer_approved_at = report.reviewer_approved_at.strftime("%B %d, %Y")
        else:
            reviewer_approved_at = str(report.reviewer_approved_at)

    context = {
        "site_name": site_name,
        "report_id": report.id,
        "report_type": report_type,
        "rule_version_used": report.rule_version_used,
        "generated_date": generated_date_str,
        "certification_outcome": report.certification_outcome.value if hasattr(report.certification_outcome, "value") else report.certification_outcome,
        "data_quality_statement": report.data_quality_statement or "",
        "reviewer_name": report.reviewer_name,
        "reviewer_approved_at": reviewer_approved_at,
        "findings": [_finding_to_dict(f) for f in sorted_findings],
        "top_findings": top_findings_data,
        "critical_count": critical_count,
        "qa_checks": qa_checks,
        "style_url": str(_TEMPLATE_DIR / "style.css"),
    }

    return render_pdf(template_name, context)
