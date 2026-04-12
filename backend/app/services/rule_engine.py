"""
backend/app/services/rule_engine.py

Rule evaluation service.

Evaluates normalised readings against the active approved RulebookEntry records
to produce Finding instances.

Core invariant (NFR-D1):
  Same reading + same rule_version → identical finding, always.

Rule evaluation is deterministic and rule-based only.
No manual threshold override paths exist in this service.
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


@dataclass
class EvaluatedFinding:
    zone_name: str
    metric_name: MetricName
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


def evaluate_readings(
    normalised_rows: list[dict],
    site_id: str,
    upload_id: str,
    rule_version: str,
    context_scope: str = "general",
) -> list[EvaluatedFinding]:
    """
    Evaluate normalised readings against the Rulebook and return findings.

    TODO (Phase 1 implementation):
    - Fetch approved RulebookEntry records for rule_version + context_scope
    - For each reading, find the matching rule by metric_name
    - Compute ThresholdBand (GOOD / WATCH / CRITICAL)
    - Fill interpretation, impact, and recommendation from rule templates
    - Attach citation_unit_ids from the matched rule
    - Return EvaluatedFinding list
    """
    raise NotImplementedError("rule_engine.evaluate_readings — Phase 1 implementation pending")
