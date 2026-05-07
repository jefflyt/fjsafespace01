"""
backend/tests/test_per_standard_evaluation.py

Tests for per-standard evaluation logic.

Tests:
- Rule engine evaluates against standard rules → correct findings
- Wellness index calculation → correct weighted score
- SafeSpace placeholder → returns "Coming Soon" status
- No applicable rules → returns INSUFFICIENT_EVIDENCE
- Band score mapping: GOOD=100, WATCH=50, CRITICAL=0
- Certification outcome thresholds: ≥90 CERTIFIED, 75-89 VERIFIED, <75 IMPROVEMENT

Tests use the embedded rule engine (unit tests) and DB-linked aggregation (integration).
"""


from app.models.enums import CertificationOutcome, ConfidenceLevel, MetricName, ThresholdBand
from app.skills.iaq_rule_governor.rule_engine import RuleDefinition, evaluate_readings
from app.skills.iaq_rule_governor.wellness_index import (
    calculate_wellness_index,
    derive_certification_outcome,
)

# Minimal test rules for unit tests (CO2: GOOD <1000, WATCH 1000-1500, CRITICAL >1500)
_TEST_RULES = [
    RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.GOOD,
        min_value=None,
        max_value=1000.0,
        interpretation_template="CO2 of {value} ppm is acceptable.",
        workforce_impact_template="Normal conditions.",
        recommendation_template="No action required.",
        rule_id="R-CO2-GOOD",
        citation_unit_ids=["CIT-TEST-001"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
    RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.WATCH,
        min_value=1000.0,
        max_value=1500.0,
        interpretation_template="CO2 of {value} ppm is elevated.",
        workforce_impact_template="May affect comfort.",
        recommendation_template="Review ventilation.",
        rule_id="R-CO2-WATCH",
        citation_unit_ids=["CIT-TEST-002"],
        confidence_level=ConfidenceLevel.MEDIUM,
    ),
    RuleDefinition(
        metric_name=MetricName.co2_ppm,
        band=ThresholdBand.CRITICAL,
        min_value=1500.0,
        max_value=None,
        interpretation_template="CO2 of {value} ppm is critical.",
        workforce_impact_template="Health risk.",
        recommendation_template="Immediate action required.",
        rule_id="R-CO2-CRITICAL",
        citation_unit_ids=["CIT-TEST-003"],
        confidence_level=ConfidenceLevel.HIGH,
    ),
]


# ── Rule Engine Unit Tests ───────────────────────────────────────────────────


class TestRuleEngineEvaluation:
    """Test the embedded rule engine evaluation."""

    def test_co2_good_classification(self):
        """CO2 at 500ppm should be classified as GOOD."""

        row = {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 500,
            "metric_unit": "ppm",
            "site_id": "site-1",
            "upload_id": "upload-1",
            "is_outlier": False,
        }
        findings = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,
        )
        assert len(findings) == 1
        assert findings[0].threshold_band == ThresholdBand.GOOD
        assert findings[0].rule_id == "R-CO2-GOOD"

    def test_co2_watch_classification(self):
        """CO2 at 1200ppm should be classified as WATCH."""
        row = {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 1200,
            "metric_unit": "ppm",
            "site_id": "site-1",
            "upload_id": "upload-1",
            "is_outlier": False,
        }
        findings = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,
        )
        assert findings[0].threshold_band == ThresholdBand.WATCH

    def test_co2_critical_classification(self):
        """CO2 at 2000ppm should be classified as CRITICAL."""
        row = {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 2000,
            "metric_unit": "ppm",
            "site_id": "site-1",
            "upload_id": "upload-1",
            "is_outlier": False,
        }
        findings = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,
        )
        assert findings[0].threshold_band == ThresholdBand.CRITICAL

    def test_findings_include_qa_g5_metadata(self):
        """Every finding must include rule_version and citation_unit_ids (QA-G5)."""
        row = {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 500,
            "metric_unit": "ppm",
            "site_id": "site-1",
            "upload_id": "upload-1",
            "is_outlier": False,
        }
        findings = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,
        )
        assert findings[0].rule_version == "v1.0"
        assert findings[0].citation_unit_ids is not None
        assert len(findings[0].citation_unit_ids) > 0

    def test_uncovered_metric_no_finding(self):
        """Reading for a metric the standard doesn't cover → no finding created."""
        # Per-standard evaluation: only metrics the standard defines produce findings
        row = {
            "zone_name": "Zone A",
            "metric_name": "pm25_ugm3",
            "metric_value": 20,
            "metric_unit": "μg/m³",
            "site_id": "site-1",
            "upload_id": "upload-1",
            "is_outlier": False,
        }
        findings = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,  # Only CO2 rules — PM25 not covered
        )
        assert len(findings) == 0

    def test_outlier_flagged_low_confidence(self):
        """Outlier readings should have LOW confidence."""
        row = {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 500,
            "metric_unit": "ppm",
            "site_id": "site-1",
            "upload_id": "upload-1",
            "is_outlier": True,
        }
        findings = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,
        )
        assert findings[0].confidence_level.value == "LOW"

    def test_deterministic_same_input_same_output(self):
        """Same reading + same rule_version → identical finding (NFR-D1)."""
        row = {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 500,
            "metric_unit": "ppm",
            "site_id": "site-1",
            "upload_id": "upload-1",
            "is_outlier": False,
        }
        findings1 = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,
        )
        findings2 = evaluate_readings(
            [row],
            site_id="site-1",
            upload_id="upload-1",
            rule_version="v1.0",
            rules=_TEST_RULES,
        )
        assert findings1[0].threshold_band == findings2[0].threshold_band
        assert findings1[0].rule_id == findings2[0].rule_id
        assert findings1[0].interpretation_text == findings2[0].interpretation_text


# ── Wellness Index Unit Tests ─────────────────────────────────────────────────


class TestWellnessIndexCalculation:
    """Test the wellness index calculation."""

    def test_all_good_scores_100(self):
        """All GOOD findings → wellness index = 100."""
        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "GOOD"},
            {"metric_name": "pm25_ugm3", "threshold_band": "GOOD"},
        ]
        weights = {"co2_ppm": 50.0, "pm25_ugm3": 50.0}
        score = calculate_wellness_index(findings, weights)
        assert score == 100.0

    def test_all_critical_scores_0(self):
        """All CRITICAL findings → wellness index = 0."""
        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "CRITICAL"},
            {"metric_name": "pm25_ugm3", "threshold_band": "CRITICAL"},
        ]
        weights = {"co2_ppm": 50.0, "pm25_ugm3": 50.0}
        score = calculate_wellness_index(findings, weights)
        assert score == 0.0

    def test_mixed_bands_weighted_score(self):
        """GOOD co2 (25%) + CRITICAL pm25 (25%) → 50.0."""
        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "GOOD"},
            {"metric_name": "pm25_ugm3", "threshold_band": "CRITICAL"},
        ]
        weights = {"co2_ppm": 25.0, "pm25_ugm3": 25.0}
        score = calculate_wellness_index(findings, weights)
        assert score == 50.0

    def test_empty_findings_returns_zero(self):
        """Empty findings → wellness index = 0."""
        weights = {"co2_ppm": 25.0}
        score = calculate_wellness_index([], weights)
        assert score == 0.0

    def test_empty_weights_returns_zero(self):
        """Empty weights → wellness index = 0."""
        findings = [{"metric_name": "co2_ppm", "threshold_band": "GOOD"}]
        score = calculate_wellness_index(findings, {})
        assert score == 0.0

    def test_band_score_mapping(self):
        """GOOD=100, WATCH=50, CRITICAL=0."""
        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "GOOD"},
        ]
        weights = {"co2_ppm": 100.0}
        assert calculate_wellness_index(findings, weights) == 100.0

        findings[0]["threshold_band"] = "WATCH"
        assert calculate_wellness_index(findings, weights) == 50.0

        findings[0]["threshold_band"] = "CRITICAL"
        assert calculate_wellness_index(findings, weights) == 0.0


# ── Certification Outcome Tests ──────────────────────────────────────────────


class TestCertificationOutcome:
    """Test certification outcome derivation."""

    def test_score_95_certified(self):
        """Score ≥ 90 → HEALTHY_WORKPLACE_CERTIFIED."""
        outcome = derive_certification_outcome(95.0)
        assert outcome == CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED

    def test_score_90_certified(self):
        """Score exactly 90 → HEALTHY_WORKPLACE_CERTIFIED."""
        outcome = derive_certification_outcome(90.0)
        assert outcome == CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED

    def test_score_80_verified(self):
        """Score 75-89 → HEALTHY_SPACE_VERIFIED."""
        outcome = derive_certification_outcome(80.0)
        assert outcome == CertificationOutcome.HEALTHY_SPACE_VERIFIED

    def test_score_75_verified(self):
        """Score exactly 75 → HEALTHY_SPACE_VERIFIED."""
        outcome = derive_certification_outcome(75.0)
        assert outcome == CertificationOutcome.HEALTHY_SPACE_VERIFIED

    def test_score_50_improvement(self):
        """Score < 75 → IMPROVEMENT_RECOMMENDED."""
        outcome = derive_certification_outcome(50.0)
        assert outcome == CertificationOutcome.IMPROVEMENT_RECOMMENDED

    def test_none_insufficient_evidence(self):
        """None score → INSUFFICIENT_EVIDENCE (never null)."""
        outcome = derive_certification_outcome(None)
        assert outcome == CertificationOutcome.INSUFFICIENT_EVIDENCE

    def test_zero_improvement(self):
        """Score 0 → IMPROVEMENT_RECOMMENDED."""
        outcome = derive_certification_outcome(0.0)
        assert outcome == CertificationOutcome.IMPROVEMENT_RECOMMENDED
