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


# Default recommendation for GOOD band — ensures consistency even if
# database templates are contradictory.
_GOOD_RECOMMENDATION = "No action required."


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


def _infer_band(entry: RulebookEntry, entries_for_metric: list[RulebookEntry] | None = None) -> ThresholdBand:
    """
    Infer the ThresholdBand from a RulebookEntry's threshold_type and min/max values.

    Heuristic based on threshold_type:
    - upper_bound:  min=None, max=fine  -> GOOD (anything below max is acceptable)
                    min=fine, max=None  -> CRITICAL (exceeds the limit)
    - lower_bound:  max=None, min=fine  -> GOOD (anything above min is acceptable)
                    max=fine, min=None  -> CRITICAL (below the minimum)
    - range:        min=fine, max=fine  -> GOOD if it's the only/lowermost range
                                          (defines the acceptable comfort zone)
                                         WATCH if there's a lower range entry
    """
    threshold_type = entry.threshold_type if hasattr(entry, "threshold_type") else None

    if threshold_type == "upper_bound":
        # upper_bound: value must stay below max_value
        if entry.max_value is not None and entry.min_value is None:
            return ThresholdBand.GOOD
        if entry.min_value is not None and entry.max_value is None:
            return ThresholdBand.CRITICAL
    elif threshold_type == "lower_bound":
        # lower_bound: value must stay above min_value
        if entry.min_value is not None and entry.max_value is None:
            return ThresholdBand.GOOD
        if entry.max_value is not None and entry.min_value is None:
            return ThresholdBand.CRITICAL
    elif threshold_type == "range":
        # range with both bounds: check if there's a lower entry for same metric
        if entry.min_value is not None and entry.max_value is not None:
            if entries_for_metric:
                # If there's another range entry with a lower min_value, this is WATCH
                has_lower = any(
                    e.id != entry.id
                    and e.threshold_type == "range"
                    and e.min_value is not None
                    and e.min_value < entry.min_value
                    for e in entries_for_metric
                )
                if has_lower:
                    return ThresholdBand.WATCH
            # Otherwise: only entry or lowermost range = GOOD (acceptable zone)
            return ThresholdBand.GOOD
        if entry.min_value is not None and entry.max_value is None:
            return ThresholdBand.CRITICAL
        if entry.min_value is None and entry.max_value is not None:
            return ThresholdBand.CRITICAL

    # Fallback for entries without threshold_type (legacy)
    if entry.max_value is None or entry.min_value is None:
        return ThresholdBand.CRITICAL
    return ThresholdBand.GOOD


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


def entry_to_rule_definition(
    entry: RulebookEntry,
    entries_for_metric: list[RulebookEntry] | None = None,
) -> RuleDefinition:
    """Convert a RulebookEntry to a RuleDefinition for use by the rule engine.

    Uses the explicit threshold_band column set at seed time.
    Falls back to _infer_band only for legacy entries without it.
    """
    metric_name = MetricName(entry.metric_name) if isinstance(entry.metric_name, str) else entry.metric_name

    band = _resolve_band(entry, entries_for_metric)

    # GOOD band always gets "No action required" recommendation
    recommendation = entry.recommendation_template
    if band == ThresholdBand.GOOD:
        recommendation = _GOOD_RECOMMENDATION

    return RuleDefinition(
        metric_name=metric_name,
        band=band,
        min_value=entry.min_value,
        max_value=entry.max_value,
        interpretation_template=entry.interpretation_template,
        workforce_impact_template=entry.business_impact_template,
        recommendation_template=recommendation,
        rule_id=_build_rule_id(metric_name, band),
        citation_unit_ids=[cid.strip() for cid in entry.citation_unit_ids.split(",") if cid.strip()],
        confidence_level=entry.confidence_level,
        reference_source_id=entry.reference_source_id,
    )


def _resolve_band(
    entry: RulebookEntry,
    entries_for_metric: list[RulebookEntry] | None = None,
) -> ThresholdBand:
    """Resolve the ThresholdBand for an entry.

    Priority: explicit threshold_band → inference fallback for legacy entries.
    """
    if entry.threshold_band:
        return ThresholdBand(entry.threshold_band)
    return _infer_band(entry, entries_for_metric)


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

    # Group entries by metric_name for band inference context
    by_metric: dict[str, list[RulebookEntry]] = {}
    for e in entries:
        metric_key = e.metric_name if isinstance(e.metric_name, str) else e.metric_name.value
        by_metric.setdefault(metric_key, []).append(e)

    return [
        entry_to_rule_definition(e, by_metric.get(
            e.metric_name if isinstance(e.metric_name, str) else e.metric_name.value, []
        ))
        for e in entries
    ]


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


def fetch_rules_by_standard(
    session: Session, source_id: str, rule_version: str
) -> list[RuleDefinition]:
    """
    Fetch approved rules for a specific certification standard.

    Args:
        session: Database session
        source_id: reference_source.id to filter by
        rule_version: rule_version string (e.g., "v2-refactor")

    Returns:
        List of RuleDefinition objects for the given standard.
    """
    entries = session.exec(
        select(RulebookEntry)
        .where(col(RulebookEntry.reference_source_id) == source_id)
        .where(col(RulebookEntry.rule_version) == rule_version)
        .where(col(RulebookEntry.approval_status) == "approved")
    ).all()

    # Group entries by metric_name for band inference context
    by_metric: dict[str, list[RulebookEntry]] = {}
    for e in entries:
        metric_key = e.metric_name if isinstance(e.metric_name, str) else e.metric_name.value
        by_metric.setdefault(metric_key, []).append(e)

    return [
        entry_to_rule_definition(e, by_metric.get(
            e.metric_name if isinstance(e.metric_name, str) else e.metric_name.value, []
        ))
        for e in entries
    ]
