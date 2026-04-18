"""
backend/app/skills/iaq_rule_governor/wellness_index.py

FJ SafeSpace Wellness Index calculator.

The Wellness Index is a 0–100% weighted score.
Metric weights MUST be read from the active RulebookEntry.index_weight_percent
values — they must NOT be hardcoded in application logic.

This ensures the Rulebook remains the strictly version-controlled anchor base
(PSD §7, PRD §6 "Transparent Weighted Scoring").

Example weight distribution (from documentation — values are illustrative):
  CO2:         25%
  PM2.5:       25%
  TVOC:        20%
  Temperature: 15%
  Humidity:    15%

Certification outcome thresholds (from PSD §6.1):
  ≥ 90.0  → HEALTHY_WORKPLACE_CERTIFIED
  75–89.9 → HEALTHY_SPACE_VERIFIED
  < 75.0  → IMPROVEMENT_RECOMMENDED
  No applicable rule set → INSUFFICIENT_EVIDENCE (never null — TDD §4.2)

Reference: PRD §6 (Transparent Weighted Scoring), TDD §4.2
"""

from app.models.enums import CertificationOutcome


def calculate_wellness_index(
    findings: list[dict],
    rulebook_weights: dict[str, float],
) -> float:
    """
    Calculate the FJ SafeSpace Wellness Index score (0.0–100.0).

    Args:
        findings:         List of finding dicts with metricName + thresholdBand.
        rulebook_weights: Dict of {metricName: weight_percent} pulled from
                          RulebookEntry.index_weight_percent for the active rule_version.
                          Weights must sum to 100.0.

    Returns:
        Wellness index score as float 0.0–100.0.
    """
    if not findings or not rulebook_weights:
        return 0.0

    # Map threshold band to a 0-100 score
    BAND_SCORES = {
        "GOOD": 100.0,
        "WATCH": 50.0,
        "CRITICAL": 0.0,
    }

    # Aggregate findings by metric — use average score per metric
    metric_scores: dict[str, list[float]] = {}
    for finding in findings:
        metric = finding["metric_name"]
        band = finding["threshold_band"]
        score = BAND_SCORES.get(band, 0.0)
        metric_scores.setdefault(metric, []).append(score)

    # Weighted average across metrics
    total_weight = sum(rulebook_weights.values())
    if total_weight == 0:
        return 0.0

    weighted_sum = 0.0
    for metric, weight in rulebook_weights.items():
        if metric in metric_scores:
            avg_score = sum(metric_scores[metric]) / len(metric_scores[metric])
            weighted_sum += avg_score * (weight / total_weight)

    return round(weighted_sum, 2)


def derive_certification_outcome(wellness_index_score: float | None) -> CertificationOutcome:
    """
    Map a Wellness Index score to a CertificationOutcome.
    Returns INSUFFICIENT_EVIDENCE if score is None (no applicable rule set).
    Never returns null — this is enforced by the return type.
    """
    if wellness_index_score is None:
        return CertificationOutcome.INSUFFICIENT_EVIDENCE
    if wellness_index_score >= 90.0:
        return CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED
    if wellness_index_score >= 75.0:
        return CertificationOutcome.HEALTHY_SPACE_VERIFIED
    return CertificationOutcome.IMPROVEMENT_RECOMMENDED
