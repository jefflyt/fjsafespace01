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
from typing import Any

from jinja2 import Environment, FileSystemLoader
from sqlmodel import Session, select, func
from weasyprint import HTML

from app.models.enums import ReportType, ThresholdBand
from app.models.workflow_b import Reading, Site

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


def render_html(template_name: str, context: dict | None = None) -> str:
    """Render a Jinja2 template into a full HTML string for immutable storage."""
    template = jinja_env.get_template(template_name)
    return template.render(context or {})


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


# Display names for metrics in report rendering
_METRIC_DISPLAY_NAMES: dict[str, str] = {
    "co2_ppm": "CO₂ (ppm)",
    "co_ppb": "CO (ppb)",
    "pm25_ugm3": "PM2.5 (µg/m³)",
    "humidity_rh": "Relative Humidity (%RH)",
    "temperature_c": "Temperature (°C)",
    "tvoc_ppb": "TVOC (ppb)",
    "o3_ppb": "Ozone (ppb)",
    "no_ppb": "NO (ppb)",
    "no2_ppb": "NO₂ (ppb)",
    "voc_ppb": "VOC (ppb)",
    "pressure_hPa": "Pressure (hPa)",
    "noise_dba": "Noise (dB(A))",
    "pm10_ugm3": "PM10 (µg/m³)",
    "aqi_index": "AQI Index",
}


def _compute_readings_context(session: Session, upload_id: str) -> dict[str, Any]:
    """
    Query all readings for an upload and compute per-zone metric statistics.

    Returns:
        {
            "zone_metric_stats": {zone_name: {metric_name: {min, max, avg, count}}},
            "zone_time_ranges": {zone_name: {start_iso, end_iso, count}},
            "all_metrics": [distinct metric names sorted],
            "sampling_date": formatted date string (e.g. "13 Jan 2026"),
            "columns_captured": [formatted metric display names],
        }
    """
    # Compute per-zone, per-metric stats
    rows = session.exec(
        select(
            Reading.zone_name,
            Reading.metric_name,
            func.min(Reading.metric_value).label("min_val"),
            func.max(Reading.metric_value).label("max_val"),
            func.avg(Reading.metric_value).label("avg_val"),
            func.count(Reading.metric_value).label("cnt"),
        )
        .where(Reading.upload_id == upload_id)
        .group_by(Reading.zone_name, Reading.metric_name)
    ).all()

    zone_metric_stats: dict[str, dict[str, dict]] = {}
    for row in rows:
        zone = row.zone_name
        metric = row.metric_name
        if zone not in zone_metric_stats:
            zone_metric_stats[zone] = {}
        zone_metric_stats[zone][metric] = {
            "min": round(row.min_val, 2),
            "max": round(row.max_val, 2),
            "avg": round(row.avg_val, 2),
            "count": row.cnt,
        }

    # Compute per-zone time ranges
    time_rows = session.exec(
        select(
            Reading.zone_name,
            func.min(Reading.reading_timestamp).label("start_ts"),
            func.max(Reading.reading_timestamp).label("end_ts"),
            func.count(Reading.reading_timestamp).label("cnt"),
        )
        .where(Reading.upload_id == upload_id)
        .group_by(Reading.zone_name)
    ).all()

    zone_time_ranges: dict[str, dict] = {}
    for row in time_rows:
        zone = row.zone_name
        zone_time_ranges[zone] = {
            "start_iso": row.start_ts.isoformat() if row.start_ts else "",
            "end_iso": row.end_ts.isoformat() if row.end_ts else "",
            "count": row.cnt,
        }

    # Distinct metrics sorted
    metric_rows = session.exec(
        select(Reading.metric_name)
        .where(Reading.upload_id == upload_id)
        .distinct()
    ).all()
    all_metrics = sorted(set(metric_rows))

    # Columns captured (formatted display names)
    columns_captured = [_METRIC_DISPLAY_NAMES.get(m, m.replace("_", " ").upper()) for m in all_metrics]

    # Sampling date from first reading
    first_reading = session.exec(
        select(Reading.reading_timestamp)
        .where(Reading.upload_id == upload_id)
        .order_by(Reading.reading_timestamp.asc())
        .limit(1)
    ).first()
    sampling_date = ""
    if first_reading:
        ts = first_reading if isinstance(first_reading, datetime) else first_reading
        sampling_date = ts.strftime("%d %b %Y") if isinstance(ts, datetime) else str(ts)

    return {
        "zone_metric_stats": zone_metric_stats,
        "zone_time_ranges": zone_time_ranges,
        "all_metrics": all_metrics,
        "sampling_date": sampling_date,
        "columns_captured": columns_captured,
    }


# Static reference lists for report rendering
_REFERENCES_DIRECTLY_APPLIED = [
    "BCA Green Mark 2021",
    "SGBC",
    "RESET Air",
    "WHO Air Quality Guidelines",
    "EPA",
    "CDC",
    "Kikkoman",
]

_REFERENCES_SUPPORTING = [
    "OSHA",
    "HSE",
    "ILO",
    "ASHRAE",
    "NEA",
    "MOM",
    "ISO 14001",
    "GRI",
    "IWBI",
]


def build_report_snapshot(
    report,
    findings: list,
    site_name: str = "Unknown Site",
    session: Session | None = None,
) -> dict:
    """
    Build an immutable snapshot of the full report at approval time.

    Stores both:
    - ``html``: fully rendered HTML string — used for on-demand PDF generation,
      guaranteeing the PDF always matches what was approved regardless of
      future template or CSS changes.
    - ``context``: structured JSON — used for dashboard rendering and export API.

    PR9: When a session is provided, enriches context with per-zone reading
    statistics, site customer info, references, and columns captured.
    """
    report_type = report.report_type
    if isinstance(report_type, ReportType):
        report_type = report_type.value

    critical_count = sum(
        1 for f in findings
        if f.threshold_band == ThresholdBand.CRITICAL
    )

    band_order = {
        ThresholdBand.CRITICAL: 0,
        ThresholdBand.WATCH: 1,
        ThresholdBand.GOOD: 2,
    }
    sorted_findings = sorted(
        findings,
        key=lambda f: band_order.get(f.threshold_band, 99),
    )

    template_map = {
        ReportType.ASSESSMENT.value: "assessment_report.html",
        ReportType.INTERVENTION_IMPACT.value: "intervention_impact_report.html",
    }
    template_name = template_map.get(report_type, "assessment_report.html")

    snapshot_findings = [_finding_to_dict(f) for f in sorted_findings]

    context = {
        "site_name": site_name,
        "report_id": report.id,
        "report_type": report_type,
        "rule_version_used": report.rule_version_used,
        "generated_date": report.generated_at.strftime("%B %d, %Y") if isinstance(report.generated_at, datetime) else str(report.generated_at),
        "certification_outcome": report.certification_outcome.value if hasattr(report.certification_outcome, "value") else report.certification_outcome,
        "data_quality_statement": report.data_quality_statement or "",
        "reviewer_name": report.reviewer_name,
        "reviewer_approved_at": report.reviewer_approved_at.strftime("%B %d, %Y") if report.reviewer_approved_at and isinstance(report.reviewer_approved_at, datetime) else None,
        "findings": snapshot_findings,
        "top_findings": snapshot_findings[:3],
        "critical_count": critical_count,
        "qa_checks": json.loads(report.qa_checks) if report.qa_checks else {},
        "style_url": str(_TEMPLATE_DIR / "style.css"),
    }

    # PR9: Enrich context with readings aggregation and site customer info
    if session is not None:
        upload_id = report.upload_id

        # Query tenant for customer info via site.tenant_id
        from app.models.workflow_b import Upload
        from app.models.supporting import Tenant
        upload_obj = session.get(Upload, upload_id)
        if upload_obj:
            site_obj = session.get(Site, upload_obj.site_id)
            if site_obj and site_obj.tenant_id:
                tenant_obj = session.get(Tenant, site_obj.tenant_id)
                if tenant_obj:
                    context["client_name"] = tenant_obj.client_name or tenant_obj.tenant_name
                    context["site_address"] = tenant_obj.site_address or ""
                    context["premises_type"] = tenant_obj.premises_type or ""
                    context["contact_person"] = tenant_obj.contact_person or ""
                    context["specific_event"] = tenant_obj.specific_event or ""
                    context["comparative_analysis"] = tenant_obj.comparative_analysis

        # Compute readings context
        readings_ctx = _compute_readings_context(session, upload_id)
        context["zone_metric_stats"] = readings_ctx["zone_metric_stats"]
        context["zone_time_ranges"] = readings_ctx["zone_time_ranges"]
        context["all_metrics"] = readings_ctx["all_metrics"]
        context["sampling_date"] = readings_ctx["sampling_date"]
        context["columns_captured"] = readings_ctx["columns_captured"]

        # Zone names from findings (ordered)
        zone_names = list(dict.fromkeys(f["zone_name"] for f in snapshot_findings))
        context["zone_names"] = zone_names

        # References
        context["references_directly_applied"] = _REFERENCES_DIRECTLY_APPLIED
        context["references_supporting"] = _REFERENCES_SUPPORTING

    # Render the full HTML string at approval time for immutability
    rendered_html = render_html(template_name, context)

    return {
        "report_id": report.id,
        "report_type": report_type,
        "site_name": site_name,
        "template": template_name,
        "context": context,
        "html": rendered_html,
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
