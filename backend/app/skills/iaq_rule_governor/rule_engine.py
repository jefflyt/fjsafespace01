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

from dataclasses import dataclass, field

from app.models.enums import (
    BenchmarkLane,
    ConfidenceLevel,
    MetricName,
    SourceCurrency,
    ThresholdBand,
)


# ── Default rulebook entries (Phase 1 baseline) ──────────────────────────────
#
# Phase 1 uses embedded rules for immediate UI unblocking.
# Phase 3+ will replace these with live RulebookEntry queries.
# Each entry maps a metric to GOOD/WATCH/CRITICAL bands.
#
# rule_id convention: R-{METRIC}-{BAND} e.g. R-CO2-GOOD


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


# Deterministic rulebook — sorted so GOOD checks before WATCH before CRITICAL
# ensures first match wins for each metric+value combination.
_DEFAULT_RULES: list[RuleDefinition] = [
    # ── CO2 (ppm) ────────────────────────────────────────────────────────────
    RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.GOOD,
        min_value=300,
        max_value=800,
        interpretation_template="CO₂ level of {value} ppm is within acceptable indoor range.",
        workforce_impact_template="Cognitive function is expected to be normal at this level.",
        recommendation_template="No action required. Maintain current ventilation.",
        rule_id="R-CO2-GOOD",
        citation_unit_ids=["CIT-WELL-001"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.WATCH,
        min_value=800,
        max_value=1200,
        interpretation_template="CO₂ level of {value} ppm is elevated. Drowsiness may increase.",
        workforce_impact_template="Mild reduction in cognitive performance may occur.",
        recommendation_template="Increase fresh air exchange rate. Monitor for sustained elevation.",
        rule_id="R-CO2-WATCH",
        citation_unit_ids=["CIT-WELL-002"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.CRITICAL,
        min_value=1200,
        max_value=None,
        interpretation_template="CO₂ level of {value} ppm exceeds safe indoor limits.",
        workforce_impact_template="Significant cognitive impairment and drowsiness likely.",
        recommendation_template="Immediately increase ventilation. Investigate HVAC or occupancy issues.",
        rule_id="R-CO2-CRITICAL",
        citation_unit_ids=["CIT-WELL-003"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    # ── PM2.5 (μg/m³) ───────────────────────────────────────────────────────
    RuleDefinition(
        metric_name=MetricName.pm25_ugm3,
        band=ThresholdBand.GOOD,
        min_value=0,
        max_value=12,
        interpretation_template="PM2.5 level of {value} μg/m³ is within WHO guideline.",
        workforce_impact_template="Respiratory health risk is low.",
        recommendation_template="No action required.",
        rule_id="R-PM25-GOOD",
        citation_unit_ids=["CIT-WHO-001"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.pm25_ugm3,
        band=ThresholdBand.WATCH,
        min_value=12,
        max_value=35,
        interpretation_template="PM2.5 level of {value} μg/m³ exceeds WHO annual guideline.",
        workforce_impact_template="Sensitive individuals may experience mild respiratory irritation.",
        recommendation_template="Check air filtration. Consider reducing outdoor air intake during pollution events.",
        rule_id="R-PM25-WATCH",
        citation_unit_ids=["CIT-WHO-002"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.pm25_ugm3,
        band=ThresholdBand.CRITICAL,
        min_value=35,
        max_value=None,
        interpretation_template="PM2.5 level of {value} μg/m³ is at unhealthy levels.",
        workforce_impact_template="Increased risk of respiratory symptoms for all occupants.",
        recommendation_template="Activate HEPA filtration. Restrict outdoor air intake. Notify occupants.",
        rule_id="R-PM25-CRITICAL",
        citation_unit_ids=["CIT-WHO-003"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    # ── TVOC (ppb) ───────────────────────────────────────────────────────────
    RuleDefinition(
        metric_name=MetricName.tvoc_ppb,
        band=ThresholdBand.GOOD,
        min_value=0,
        max_value=220,
        interpretation_template="TVOC level of {value} ppb is within acceptable range.",
        workforce_impact_template="No immediate health effects expected.",
        recommendation_template="No action required.",
        rule_id="R-TVOC-GOOD",
        citation_unit_ids=["CIT-IAQ-001"],
        confidence_level=ConfidenceLevel.MEDIUM,
    ),
    RuleDefinition(
        metric_name=MetricName.tvoc_ppb,
        band=ThresholdBand.WATCH,
        min_value=220,
        max_value=660,
        interpretation_template="TVOC level of {value} ppb is elevated. Off-gassing or chemical sources suspected.",
        workforce_impact_template="Possible headaches or irritation for sensitive occupants.",
        recommendation_template="Identify and remove VOC sources. Increase ventilation.",
        rule_id="R-TVOC-WATCH",
        citation_unit_ids=["CIT-IAQ-002"],
        confidence_level=ConfidenceLevel.MEDIUM,
    ),
    RuleDefinition(
        metric_name=MetricName.tvoc_ppb,
        band=ThresholdBand.CRITICAL,
        min_value=660,
        max_value=None,
        interpretation_template="TVOC level of {value} ppb exceeds safe exposure limits.",
        workforce_impact_template="Significant risk of acute health symptoms.",
        recommendation_template="Evacuate if occupants report symptoms. Conduct source investigation.",
        rule_id="R-TVOC-CRITICAL",
        citation_unit_ids=["CIT-IAQ-003"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    # ── Temperature (°C) ─────────────────────────────────────────────────────
    RuleDefinition(
        metric_name=MetricName.temperature_c,
        band=ThresholdBand.GOOD,
        min_value=20,
        max_value=26,
        interpretation_template="Temperature of {value}°C is within thermal comfort zone.",
        workforce_impact_template="Comfortable conditions for productivity.",
        recommendation_template="No action required.",
        rule_id="R-TEMP-GOOD",
        citation_unit_ids=["CIT-ASHRAE-001"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.temperature_c,
        band=ThresholdBand.WATCH,
        min_value=17,
        max_value=20,
        interpretation_template="Temperature of {value}°C is below comfort range.",
        workforce_impact_template="Occupants may feel uncomfortably cool.",
        recommendation_template="Adjust heating setpoint. Check for drafts.",
        rule_id="R-TEMP-WATCH-LOW",
        citation_unit_ids=["CIT-ASHRAE-002"],
        confidence_level=ConfidenceLevel.MEDIUM,
    ),
    RuleDefinition(
        metric_name=MetricName.temperature_c,
        band=ThresholdBand.WATCH,
        min_value=26,
        max_value=30,
        interpretation_template="Temperature of {value}°C is above comfort range.",
        workforce_impact_template="Mild heat stress may reduce productivity.",
        recommendation_template="Adjust cooling setpoint. Verify HVAC operation.",
        rule_id="R-TEMP-WATCH-HIGH",
        citation_unit_ids=["CIT-ASHRAE-002"],
        confidence_level=ConfidenceLevel.MEDIUM,
    ),
    RuleDefinition(
        metric_name=MetricName.temperature_c,
        band=ThresholdBand.CRITICAL,
        min_value=30,
        max_value=None,
        interpretation_template="Temperature of {value}°C exceeds safe workplace limits.",
        workforce_impact_template="Heat stress risk. Productivity significantly impaired.",
        recommendation_template="Activate emergency cooling. Allow remote work if conditions persist.",
        rule_id="R-TEMP-CRITICAL-HIGH",
        citation_unit_ids=["CIT-ASHRAE-003"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.temperature_c,
        band=ThresholdBand.CRITICAL,
        min_value=None,
        max_value=10,
        interpretation_template="Temperature of {value}°C is below safe workplace limits.",
        workforce_impact_template="Cold stress risk. Dexterity and comfort significantly reduced.",
        recommendation_template="Activate emergency heating. Inspect for heating system failure.",
        rule_id="R-TEMP-CRITICAL-LOW",
        citation_unit_ids=["CIT-ASHRAE-003"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    # ── Humidity (%RH) ───────────────────────────────────────────────────────
    RuleDefinition(
        metric_name=MetricName.humidity_rh,
        band=ThresholdBand.GOOD,
        min_value=30,
        max_value=60,
        interpretation_template="Humidity of {value}%RH is within ideal range.",
        workforce_impact_template="Comfortable conditions. Low mold and mite risk.",
        recommendation_template="No action required.",
        rule_id="R-HUM-GOOD",
        citation_unit_ids=["CIT-ASHRAE-004"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.humidity_rh,
        band=ThresholdBand.WATCH,
        min_value=20,
        max_value=30,
        interpretation_template="Humidity of {value}%RH is dry. Static and dryness likely.",
        workforce_impact_template="Dry skin and respiratory irritation possible.",
        recommendation_template="Consider humidification. Monitor for static-sensitive equipment.",
        rule_id="R-HUM-WATCH-LOW",
        citation_unit_ids=["CIT-ASHRAE-005"],
        confidence_level=ConfidenceLevel.MEDIUM,
    ),
    RuleDefinition(
        metric_name=MetricName.humidity_rh,
        band=ThresholdBand.WATCH,
        min_value=60,
        max_value=70,
        interpretation_template="Humidity of {value}%RH is elevated. Mold growth conditions possible.",
        workforce_impact_template="Allergen levels may increase.",
        recommendation_template="Activate dehumidification. Check for moisture intrusion.",
        rule_id="R-HUM-WATCH-HIGH",
        citation_unit_ids=["CIT-ASHRAE-005"],
        confidence_level=ConfidenceLevel.MEDIUM,
    ),
    RuleDefinition(
        metric_name=MetricName.humidity_rh,
        band=ThresholdBand.CRITICAL,
        min_value=70,
        max_value=None,
        interpretation_template="Humidity of {value}%RH creates high mold and pathogen risk.",
        workforce_impact_template="Significant allergen and respiratory health risk.",
        recommendation_template="Immediate dehumidification. Inspect for water damage.",
        rule_id="R-HUM-CRITICAL-HIGH",
        citation_unit_ids=["CIT-ASHRAE-006"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.humidity_rh,
        band=ThresholdBand.CRITICAL,
        min_value=None,
        max_value=20,
        interpretation_template="Humidity of {value}%RH is critically low.",
        workforce_impact_template="Severe dryness. Static discharge and equipment risk.",
        recommendation_template="Emergency humidification required.",
        rule_id="R-HUM-CRITICAL-LOW",
        citation_unit_ids=["CIT-ASHRAE-006"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
]


def _find_matching_rule(
    metric_name: MetricName,
    value: float,
    rules: list[RuleDefinition] | None = None,
) -> RuleDefinition | None:
    """
    Find the first rule that matches the given metric and value range.
    Returns None if no rule matches (which should not happen with the default set).
    """
    target_rules = rules if rules is not None else _DEFAULT_RULES
    for rule in target_rules:
        if rule.metric_name != metric_name:
            continue
        min_ok = rule.min_value is None or value >= rule.min_value
        max_ok = rule.max_value is None or value <= rule.max_value
        if min_ok and max_ok:
            return rule
    return None


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
            # No matching rule — create an Insufficient Evidence finding (QA-G5 fallback)
            findings.append(
                EvaluatedFinding(
                    zone_name=row["zone_name"],
                    metric_name=metric_name,
                    metric_value=value,
                    metric_unit=row["metric_unit"],
                    threshold_band=ThresholdBand.WATCH,
                    interpretation_text=f"No applicable rule found for {metric_name_str} at {value}. Manual review required.",
                    workforce_impact_text="Unable to determine impact without applicable rule.",
                    recommended_action="Manual assessment required. No automated finding can be generated.",
                    rule_id="R-INSUFFICIENT",
                    rule_version=rule_version,
                    citation_unit_ids=["CIT-MANUAL"],
                    confidence_level=ConfidenceLevel.LOW,
                    source_currency_status=SourceCurrency.VERSION_UNVERIFIED,
                    benchmark_lane=BenchmarkLane.FJ_SAFESPACE,
                )
            )
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
