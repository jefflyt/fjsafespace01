"""
backend/app/services/db_rule_service.py

DB-backed rule service.

Fetches active rules from the rulebook_entry table and converts
them to RuleDefinition objects for use by the rule engine.

This replaces the hardcoded _DEFAULT_RULES with database-driven rules
while maintaining the same RuleDefinition interface for backward compatibility.
"""

from sqlmodel import Session, col, select

from app.models.enums import MetricName, ThresholdBand
from app.models.workflow_a import RulebookEntry
from app.skills.iaq_rule_governor.rule_engine import RuleDefinition


# ── Band extraction ───────────────────────────────────────────────────────────


def extract_band_from_rule_id(rule_id: str) -> ThresholdBand | None:
    """
    Extract the ThresholdBand from a rule_id string.

    rule_id format: R-{METRIC}-{BAND_SUFFIX}
    Examples: R-CO2-GOOD, R-TEMP-WATCH-HIGH, R-HUM-CRITICAL-LOW
    """
    parts = rule_id.split("-")
    if len(parts) < 3:
        return None

    suffix = "-".join(parts[2:]).upper()

    if suffix == "GOOD":
        return ThresholdBand.GOOD
    if suffix.startswith("WATCH"):
        return ThresholdBand.WATCH
    if suffix.startswith("CRITICAL"):
        return ThresholdBand.CRITICAL

    return None


# ── Band inference (fallback for entries without rule_id) ─────────────────────


def _infer_band(entry: RulebookEntry) -> ThresholdBand:
    """
    Infer the ThresholdBand from a RulebookEntry's min/max values.

    Heuristic:
    - min_value == 0 with finite max_value -> GOOD
    - Both min and max finite, min > 0 -> WATCH
    - max_value is None or min_value is None -> CRITICAL
    """
    if entry.max_value is None or entry.min_value is None:
        return ThresholdBand.CRITICAL
    if entry.min_value == 0:
        return ThresholdBand.GOOD
    return ThresholdBand.WATCH


def _build_rule_id(metric_name: MetricName, band: ThresholdBand) -> str:
    """
    Build a rule_id from metric name and band.
    e.g., R-CO2-GOOD, R-PM25-WATCH, R-TEMP-CRITICAL
    """
    metric_short = {
        MetricName.co2_ppm: "CO2",
        MetricName.pm25_ugm3: "PM25",
        MetricName.tvoc_ppb: "TVOC",
        MetricName.temperature_c: "TEMP",
        MetricName.humidity_rh: "HUM",
    }.get(metric_name, metric_name.value.upper())

    return f"R-{metric_short}-{band.value}"


def entry_to_rule_definition(entry: RulebookEntry) -> RuleDefinition:
    """Convert a RulebookEntry to a RuleDefinition for use by the rule engine."""
    metric_name = MetricName(entry.metric_name) if isinstance(entry.metric_name, str) else entry.metric_name

    band = _infer_band(entry)

    return RuleDefinition(
        metric_name=metric_name,
        band=band,
        min_value=entry.min_value,
        max_value=entry.max_value,
        interpretation_template=entry.interpretation_template,
        workforce_impact_template=entry.business_impact_template,
        recommendation_template=entry.recommendation_template,
        rule_id=_build_rule_id(metric_name, band),
        citation_unit_ids=[cid.strip() for cid in entry.citation_unit_ids.split(",") if cid.strip()],
        confidence_level=entry.confidence_level,
    )


# ── DB fetching ───────────────────────────────────────────────────────────────


def fetch_rules_from_db(session: Session, rule_version: str) -> list[RuleDefinition]:
    """
    Fetch all approved rules for the given rule_version from the database.
    Returns them as RuleDefinition objects compatible with the rule engine.
    """
    entries = session.exec(
        select(RulebookEntry)
        .where(col(RulebookEntry.rule_version) == rule_version)
        .where(col(RulebookEntry.approval_status) == "approved")
    ).all()

    return [entry_to_rule_definition(e) for e in entries]


def get_latest_approved_version(session: Session) -> str | None:
    """
    Return the latest rule_version that has approved entries.
    Returns None if no approved rules exist.
    """
    entries = session.exec(
        select(RulebookEntry.rule_version)
        .where(col(RulebookEntry.approval_status) == "approved")
    ).all()

    if not entries:
        return None

    return max(entries)
