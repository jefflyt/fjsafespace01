"""
backend/tests/unit/test_rule_engine.py

Unit tests for the rule evaluation service.

Each test fixture must be self-contained — no DB connection required.

Key invariants from TDD §8.1:
- Rule evaluation determinism: same reading + same rule_version → identical finding
- Parse outcome state machine transitions correct
- QA gate enforcement: each gate individually asserted

All 9 QA gate tests (QA-G4 through QA-G9) must pass before merge to main.
"""

import pytest

from app.models.enums import MetricName, ThresholdBand
from app.skills.iaq_rule_governor.rule_engine import evaluate_readings, _find_matching_rule, RuleDefinition


# ── Determinism tests ─────────────────────────────────────────────────────────


def test_rule_evaluation_is_deterministic():
    """
    Same reading + same rule_version must always produce an identical finding.
    TDD §8.1 — 'Rule evaluation determinism'
    """
    # TODO: implement once rule_engine.evaluate_readings is built
    pytest.skip("Not yet implemented")


# ── Parse outcome state machine ───────────────────────────────────────────────


def test_parse_outcome_pass():
    """All required columns present, no outliers → PASS."""
    pytest.skip("Not yet implemented")


def test_parse_outcome_pass_with_warnings():
    """Required columns present, minor outliers flagged → PASS_WITH_WARNINGS."""
    pytest.skip("Not yet implemented")


def test_parse_outcome_fail_missing_columns():
    """Required column missing → FAIL."""
    pytest.skip("Not yet implemented")


# ── QA gate enforcement — one test per gate ───────────────────────────────────


def test_qa_gate_g4_data_quality_statement_absent():
    """QA-G4: report generation blocked if dataQualityStatement absent."""
    pytest.skip("Not yet implemented")


def test_qa_gate_g5_missing_citation_unit_ids():
    """QA-G5: report generation returns 422 if finding is missing citationUnitIds."""
    pytest.skip("Not yet implemented")


def test_qa_gate_g5_missing_rule_version():
    """QA-G5: report generation returns 422 if finding is missing ruleVersion."""
    pytest.skip("Not yet implemented")


def test_qa_gate_g6_non_current_source_without_advisory():
    """QA-G6: cert-path finding with PARTIAL_EXTRACT source and no advisory label → 422."""
    pytest.skip("Not yet implemented")


def test_qa_gate_g7_insufficient_evidence_not_null():
    """QA-G7: certificationOutcome must never be null — INSUFFICIENT_EVIDENCE returned."""
    pytest.skip("Not yet implemented")


def test_qa_gate_g8_reviewer_not_approver():
    """QA-G8: APPROVED transition blocked if reviewerName != APPROVER_EMAIL."""
    pytest.skip("Not yet implemented")


def test_qa_gate_g9_tenant_id_missing_phase3():
    """QA-G9 (Phase 3): customer-role request without tenant_id returns 403."""
    pytest.skip("Not yet implemented")


# ── DB-backed rule evaluation ─────────────────────────────────────────────────


def test_find_matching_rule_uses_provided_rules():
    """
    When rules are passed as a parameter, _find_matching_rule uses them
    instead of the hardcoded _DEFAULT_RULES.
    """
    from app.models.enums import ConfidenceLevel

    custom_good = RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.GOOD,
        min_value=300.0,
        max_value=800.0,
        interpretation_template="Custom CO2 good.",
        workforce_impact_template="Custom impact.",
        recommendation_template="Custom action.",
        rule_id="R-CO2-GOOD",
        citation_unit_ids=["CIT-CUSTOM-001"],
        confidence_level=ConfidenceLevel.HIGH,
    )

    # Value 500 matches the custom GOOD rule (300-800)
    result = _find_matching_rule(MetricName.co2_ppm, 500.0, rules=[custom_good])
    assert result is not None
    assert result.rule_id == "R-CO2-GOOD"
    assert result.band == ThresholdBand.GOOD

    # Value 900 doesn't match any custom rule
    result = _find_matching_rule(MetricName.co2_ppm, 900.0, rules=[custom_good])
    assert result is None


def test_find_matching_rule_falls_back_to_defaults():
    """
    When no rules are provided, _find_matching_rule uses _DEFAULT_RULES.
    """
    result = _find_matching_rule(MetricName.co2_ppm, 500.0)
    assert result is not None
    assert result.rule_id == "R-CO2-GOOD"


def test_rule_evaluation_with_custom_rules():
    """
    evaluate_readings uses the provided rules parameter for evaluation.
    """
    from app.models.enums import ConfidenceLevel

    custom_rule = RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.GOOD,
        min_value=300.0,
        max_value=800.0,
        interpretation_template="CO2 level of {value} ppm is acceptable.",
        workforce_impact_template="Normal cognitive function.",
        recommendation_template="No action.",
        rule_id="R-CO2-GOOD",
        citation_unit_ids=["CIT-CO2-GOOD"],
        confidence_level=ConfidenceLevel.HIGH,
    )

    rows = [
        {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 500.0,
            "metric_unit": "ppm",
            "is_outlier": False,
        }
    ]

    findings = evaluate_readings(
        rows,
        site_id="test-site",
        upload_id="test-upload",
        rule_version="v1.0",
        rules=[custom_rule],
    )

    assert len(findings) == 1
    assert findings[0].threshold_band == ThresholdBand.GOOD
    assert findings[0].rule_id == "R-CO2-GOOD"
    assert findings[0].rule_version == "v1.0"
    assert findings[0].citation_unit_ids == ["CIT-CO2-GOOD"]
