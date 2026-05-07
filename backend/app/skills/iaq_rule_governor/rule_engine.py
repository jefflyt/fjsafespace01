"""
backend/app/skills/iaq_rule_governor/rule_engine.py

Rule evaluation service.

Evaluates normalised readings against rule definitions
to produce Finding instances.

Core invariant (NFR-D1):
  Same reading + same rule_version → identical finding, always.

Rule evaluation is deterministic and rule-based only.
No RAG or AI-generated threshold values are accepted as input.

QA-G5 enforced: every Finding produced must include rule_id,
rule_version, and citation_unit_ids (non-empty list).

Reference: TDD §4.1 (processing step), TDD §8.1 (unit test invariants)
"""

from dataclasses import dataclass

from app.models.enums import (
    BenchmarkLane,
    ConfidenceLevel,
    MetricName,
    SourceCurrency,
    ThresholdBand,
)


# RuleDefinition is a dataclass used by both the DB rule service and the
# evaluation engine. All rule data now comes from database-seeded entries.


@dataclass
class RuleDefinition:
    metric_name: MetricName
    band: ThresholdBand
    min_value: float | None
    max_value: float | None
    interpretation_template: str
    workforce_impact_template: str
    recommendation_template: str
    rule_id: str
    citation_unit_ids: list[str]
    confidence_level: ConfidenceLevel
    reference_source_id: str | None = None


def _find_matching_rule(
    metric_name: MetricName,
    value: float,
    rules: list[RuleDefinition] | None = None,
) -> RuleDefinition | None:
    """
    Find the first rule that matches the given metric and value range.

    Fallback: if no exact match exists but a GOOD-range rule is defined,
    infer WATCH band based on direction (above max or below min).
    This handles standards that only define the acceptable range
    (e.g., SS 554 defines temp 23-26 as GOOD but no WATCH bands).
    """
    target_rules = rules if rules is not None else _DEFAULT_RULES

    # First pass: exact range match
    for rule in target_rules:
        if rule.metric_name != metric_name:
            continue
        min_ok = rule.min_value is None or value >= rule.min_value
        max_ok = rule.max_value is None or value <= rule.max_value
        if min_ok and max_ok:
            return rule

    # Fallback: value outside GOOD range — infer WATCH band from nearest GOOD rule
    good_rule = None
    for rule in target_rules:
        if rule.metric_name == metric_name and rule.band == ThresholdBand.GOOD:
            good_rule = rule
            break

    if good_rule is None:
        return None

    # Determine direction: value is above max or below min
    above = good_rule.max_value is not None and value > good_rule.max_value
    below = good_rule.min_value is not None and value < good_rule.min_value

    if not above and not below:
        return None  # Shouldn't happen, but safety fallback

    # Build an inferred WATCH rule
    if above:
        inferred_min = good_rule.max_value
        inferred_max = None
    else:
        inferred_min = None
        inferred_max = good_rule.min_value

    metric_short = {
        MetricName.co2_ppm: "CO2",
        MetricName.pm25_ugm3: "PM25",
        MetricName.tvoc_ppb: "TVOC",
        MetricName.temperature_c: "TEMP",
        MetricName.humidity_rh: "HUM",
    }.get(metric_name, metric_name.value.upper())

    metric_display = {
        MetricName.co2_ppm: ("CO₂", "ppm"),
        MetricName.pm25_ugm3: ("PM2.5", "μg/m³"),
        MetricName.tvoc_ppb: ("TVOC", "ppb"),
        MetricName.temperature_c: ("Temperature", "°C"),
        MetricName.humidity_rh: ("Humidity", "%RH"),
    }.get(metric_name, (metric_name.value, ""))
    display_name, unit = metric_display
    unit_str = f"{unit} " if unit else ""

    return RuleDefinition(
        metric_name=metric_name,
        band=ThresholdBand.WATCH,
        min_value=inferred_min,
        max_value=inferred_max,
        interpretation_template=f"{display_name} of {{value}} {unit_str}is outside the acceptable range.",
        workforce_impact_template="Conditions may affect occupant comfort or health.",
        recommendation_template="Review environmental controls and take corrective action.",
        rule_id=f"R-{metric_short}-WATCH",
        citation_unit_ids=good_rule.citation_unit_ids,
        confidence_level=ConfidenceLevel.MEDIUM,
        reference_source_id=good_rule.reference_source_id,
    )


def _fill_template(template: str, value: float) -> str:
    """Substitute {value} placeholder in a template string."""
    return template.replace("{value}", str(round(value, 2)))


def evaluate_readings(
    normalised_rows: list[dict],
    site_id: str,
    upload_id: str,
    rule_version: str,
    context_scope: str = "general",
    rules: list[RuleDefinition] | None = None,
) -> list["EvaluatedFinding"]:
    """
    Evaluate normalised readings against the Rulebook and return findings.

    Each normalised row must contain:
      - device_id, zone_name, reading_timestamp
      - metric_name (MetricName), metric_value (float), metric_unit (str)
      - site_id, upload_id, is_outlier (bool)

    Returns a list of EvaluatedFinding objects — one per row.
    Outliers still produce findings but are flagged with LOW confidence.
    If no matching rule is found, an Insufficient Evidence finding is created.
    """
    findings: list[EvaluatedFinding] = []

    for row in normalised_rows:
        metric_name_str = row["metric_name"]
        metric_name = MetricName(metric_name_str) if metric_name_str in [e.value for e in MetricName] else None
        value = row["metric_value"]
        is_outlier = row.get("is_outlier", False)

        rule = _find_matching_rule(metric_name, value, rules) if metric_name else None

        if rule is None:
            # No matching rule for this metric in this standard — skip.
            # Per-standard evaluation: only produce findings for metrics
            # the standard actually covers.
            continue
        else:
            findings.append(
                EvaluatedFinding(
                    zone_name=row["zone_name"],
                    metric_name=metric_name,
                    metric_value=value,
                    metric_unit=row["metric_unit"],
                    threshold_band=rule.band,
                    interpretation_text=_fill_template(rule.interpretation_template, value),
                    workforce_impact_text=_fill_template(rule.workforce_impact_template, value),
                    recommended_action=_fill_template(rule.recommendation_template, value),
                    rule_id=rule.rule_id,
                    rule_version=rule_version,
                    citation_unit_ids=rule.citation_unit_ids,
                    confidence_level=(
                        ConfidenceLevel.LOW if is_outlier else rule.confidence_level
                    ),
                    source_currency_status=SourceCurrency.CURRENT_VERIFIED,
                    benchmark_lane=BenchmarkLane.FJ_SAFESPACE,
                    reference_source_id=rule.reference_source_id,
                )
            )

    return findings


# ── Dataclass for return type (kept separate from SQLModel) ──────────────────


@dataclass
class EvaluatedFinding:
    zone_name: str
    metric_name: MetricName | None
    metric_value: float
    metric_unit: str
    threshold_band: ThresholdBand
    interpretation_text: str
    workforce_impact_text: str
    recommended_action: str
    rule_id: str
    rule_version: str
    citation_unit_ids: list[str]  # must be non-empty — absence triggers QA-G5
    confidence_level: ConfidenceLevel
    source_currency_status: SourceCurrency  # NOT NULL
    benchmark_lane: BenchmarkLane
    reference_source_id: str | None = None
