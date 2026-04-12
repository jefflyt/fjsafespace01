"""
backend/app/services/wellness_index.py

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

    TODO (Phase 1 implementation):
    - Map ThresholdBand → metric score (GOOD=100, WATCH=50, CRITICAL=0)
    - Multiply by weight from rulebook_weights
    - Sum → wellness_index_score
    """
    raise NotImplementedError("wellness_index.calculate — Phase 1 implementation pending")


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
