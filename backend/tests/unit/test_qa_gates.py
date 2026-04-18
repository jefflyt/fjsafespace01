"""
backend/tests/unit/test_qa_gates.py

Unit tests for the QA Gate service.
Tests each gate (QA-G1 through QA-G8) individually with mocked Report and Finding payloads.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.models.enums import (
    CertificationOutcome,
    ConfidenceLevel,
    MetricName,
    ReportType,
    ReviewerStatus,
    SourceCurrency,
    ThresholdBand,
)
from app.services.qa_gates import (
    can_approve_report,
    evaluate_qa_g1,
    evaluate_qa_g2,
    evaluate_qa_g3,
    evaluate_qa_g4,
    evaluate_qa_g5,
    evaluate_qa_g6,
    evaluate_qa_g7,
    evaluate_qa_g8,
    run_all_qa_gates,
)


def make_finding(**kwargs):
    """Create a mock Finding with sensible defaults."""
    f = MagicMock()
    f.id = "finding-001"
    f.upload_id = "upload-001"
    f.site_id = "site-001"
    f.zone_name = "Zone A"
    f.metric_name = MetricName.co2_ppm
    f.threshold_band = ThresholdBand.GOOD
    f.interpretation_text = "Air quality is good."
    f.workforce_impact_text = "No impact expected."
    f.recommended_action = "Continue monitoring."
    f.rule_id = "rule-co2-001"
    f.rule_version = "v1.0"
    f.citation_unit_ids = json.dumps(["cit-001", "cit-002"])
    f.confidence_level = ConfidenceLevel.HIGH
    f.source_currency_status = SourceCurrency.CURRENT_VERIFIED
    f.benchmark_lane = "FJ_SAFESPACE"
    for k, v in kwargs.items():
        setattr(f, k, v)
    return f


def make_report(**kwargs):
    """Create a mock Report with sensible defaults."""
    r = MagicMock()
    r.id = "report-001"
    r.report_type = ReportType.ASSESSMENT
    r.upload_id = "upload-001"
    r.site_id = "site-001"
    r.report_version = 1
    r.rule_version_used = "v1.0"
    r.citation_ids_used = json.dumps(["cit-001"])
    r.reviewer_name = "Jay Choy"
    r.reviewer_status = ReviewerStatus.DRAFT_GENERATED
    r.reviewer_approved_at = None
    r.qa_checks = "{}"
    r.data_quality_statement = "Data verified by analyst."
    r.certification_outcome = CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED
    r.pdf_url = None
    for k, v in kwargs.items():
        setattr(r, k, v)
    return r


class TestQAG1:
    """QA-G1: Citations must link to rule_version and citation_unit_ids."""

    def test_pass(self):
        report = make_report()
        findings = [make_finding()]
        result = evaluate_qa_g1(report, findings)
        assert result.passed is True

    def test_fail_missing_rule_version(self):
        findings = [make_finding(rule_version="")]
        result = evaluate_qa_g1(make_report(), findings)
        assert result.passed is False
        assert "rule_version" in result.message

    def test_fail_empty_citation_ids(self):
        findings = [make_finding(citation_unit_ids=json.dumps([]))]
        result = evaluate_qa_g1(make_report(), findings)
        assert result.passed is False
        assert "citation_unit_ids" in result.message


class TestQAG2:
    """QA-G2: Non-CURRENT_VERIFIED sources must be present (not null)."""

    def test_pass_current_verified(self):
        findings = [make_finding(source_currency_status=SourceCurrency.CURRENT_VERIFIED)]
        result = evaluate_qa_g2(findings)
        assert result.passed is True

    def test_pass_partial_extract(self):
        findings = [make_finding(source_currency_status=SourceCurrency.PARTIAL_EXTRACT)]
        result = evaluate_qa_g2(findings)
        assert result.passed is True

    def test_fail_null_status(self):
        findings = [make_finding(source_currency_status=None)]
        result = evaluate_qa_g2(findings)
        assert result.passed is False


class TestQAG3:
    """QA-G3: report_type must be valid."""

    def test_pass_assessment(self):
        result = evaluate_qa_g3(make_report(report_type=ReportType.ASSESSMENT))
        assert result.passed is True

    def test_pass_intervention(self):
        result = evaluate_qa_g3(make_report(report_type=ReportType.INTERVENTION_IMPACT))
        assert result.passed is True


class TestQAG4:
    """QA-G4: dataQualityStatement must be present."""

    def test_pass(self):
        result = evaluate_qa_g4(make_report(data_quality_statement="Verified."))
        assert result.passed is True

    def test_fail_missing(self):
        result = evaluate_qa_g4(make_report(data_quality_statement=""))
        assert result.passed is False

    def test_fail_none(self):
        result = evaluate_qa_g4(make_report(data_quality_statement=None))
        assert result.passed is False


class TestQAG5:
    """QA-G5: All findings must have ruleVersion + citationUnitIds."""

    def test_pass(self):
        result = evaluate_qa_g5(make_report(), [make_finding()])
        assert result.passed is True

    def test_fail_missing_rule_version(self):
        result = evaluate_qa_g5(make_report(), [make_finding(rule_version=None)])
        assert result.passed is False

    def test_fail_empty_citations(self):
        result = evaluate_qa_g5(make_report(), [make_finding(citation_unit_ids=json.dumps([]))])
        assert result.passed is False


class TestQAG6:
    """QA-G6: sourceCurrencyStatus must be a valid enum value."""

    def test_pass_current(self):
        result = evaluate_qa_g6([make_finding(source_currency_status=SourceCurrency.CURRENT_VERIFIED)])
        assert result.passed is True

    def test_fail_superseded(self):
        result = evaluate_qa_g6([make_finding(source_currency_status=SourceCurrency.SUPERSEDED)])
        assert result.passed is False


class TestQAG7:
    """QA-G7: certificationOutcome must not be null."""

    def test_pass(self):
        result = evaluate_qa_g7(make_report(certification_outcome=CertificationOutcome.HEALTHY_SPACE_VERIFIED))
        assert result.passed is True

    def test_fail_null(self):
        result = evaluate_qa_g7(make_report(certification_outcome=None))
        assert result.passed is False


class TestQAG8:
    """QA-G8: reviewerName must match APPROVER_EMAIL for certification-impact reports."""

    @patch("app.services.qa_gates.settings")
    def test_pass_correct_reviewer(self, mock_settings):
        mock_settings.APPROVER_EMAIL = "Jay Choy"
        result = evaluate_qa_g8(make_report(reviewer_name="Jay Choy"))
        assert result.passed is True

    @patch("app.services.qa_gates.settings")
    def test_fail_wrong_reviewer(self, mock_settings):
        mock_settings.APPROVER_EMAIL = "Jay Choy"
        result = evaluate_qa_g8(make_report(reviewer_name="Some Analyst"))
        assert result.passed is False
        assert "authorized approver" in result.message

    @patch("app.services.qa_gates.settings")
    def test_skip_for_non_cert(self, mock_settings):
        """Non-certification outcomes should skip the reviewer check."""
        mock_settings.APPROVER_EMAIL = "Jay Choy"
        result = evaluate_qa_g8(make_report(
            reviewer_name="Anyone",
            certification_outcome=CertificationOutcome.IMPROVEMENT_RECOMMENDED,
        ))
        assert result.passed is True


class TestRunAllGates:
    """Integration: run_all_qa_gates and can_approve_report."""

    @patch("app.services.qa_gates.settings")
    def test_all_pass(self, mock_settings):
        mock_settings.APPROVER_EMAIL = "Jay Choy"
        report = make_report()
        findings = [make_finding()]
        all_passed, results = can_approve_report(report, findings)
        assert all_passed is True
        assert len(results) == 8

    @patch("app.services.qa_gates.settings")
    def test_fail_on_missing_dqs(self, mock_settings):
        mock_settings.APPROVER_EMAIL = "Jay Choy"
        report = make_report(data_quality_statement=None)
        findings = [make_finding()]
        all_passed, results = can_approve_report(report, findings)
        assert all_passed is False
        qa_g4 = [r for r in results if r.gate == "QA-G4"][0]
        assert qa_g4.passed is False

    @patch("app.services.qa_gates.settings")
    def test_fail_on_wrong_reviewer(self, mock_settings):
        mock_settings.APPROVER_EMAIL = "Jay Choy"
        report = make_report(reviewer_name="Wrong Person")
        findings = [make_finding()]
        all_passed, results = can_approve_report(report, findings)
        assert all_passed is False
        qa_g8 = [r for r in results if r.gate == "QA-G8"][0]
        assert qa_g8.passed is False
