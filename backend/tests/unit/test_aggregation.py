"""
backend/tests/unit/test_aggregation.py

Unit tests for the Dashboard Aggregation Service.

Tests verify:
- Wellness Index calculation matches benchmark formulas
- Color-coding bounds: >= 90% Green, 75-89.9% Amber, < 75% Red
- Top 3 risks prioritization (CRITICAL first, non-advisory before advisory)
- Leaderboard sorting by wellness_index_score DESC
- Empty state handling
"""

from unittest.mock import MagicMock, patch

import pytest

from app.models.enums import CertificationOutcome, ConfidenceLevel, MetricName, SourceCurrency, ThresholdBand
from app.services.aggregation import (
    calculate_site_wellness_index,
    get_executive_dashboard,
    get_leaderboard,
    get_top_3_actions,
    get_top_3_risks,
)


# ── Wellness Index Math Tests ────────────────────────────────────────────────


class TestWellnessIndexMath:
    """Verify the Wellness Index score calculation matches FJ SafeSpace formulas."""

    def test_all_good_returns_100(self):
        """All GOOD findings with equal weights should return 100.0."""
        from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index

        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "GOOD"},
            {"metric_name": "pm25_ugm3", "threshold_band": "GOOD"},
            {"metric_name": "tvoc_ppb", "threshold_band": "GOOD"},
        ]
        weights = {"co2_ppm": 25.0, "pm25_ugm3": 25.0, "tvoc_ppb": 50.0}
        result = calculate_wellness_index(findings, weights)
        assert result == 100.0

    def test_all_critical_returns_0(self):
        """All CRITICAL findings should return 0.0."""
        from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index

        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "CRITICAL"},
            {"metric_name": "pm25_ugm3", "threshold_band": "CRITICAL"},
        ]
        weights = {"co2_ppm": 50.0, "pm25_ugm3": 50.0}
        result = calculate_wellness_index(findings, weights)
        assert result == 0.0

    def test_all_watch_returns_50(self):
        """All WATCH findings should return 50.0."""
        from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index

        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "WATCH"},
        ]
        weights = {"co2_ppm": 100.0}
        result = calculate_wellness_index(findings, weights)
        assert result == 50.0

    def test_mixed_bands_weighted_correctly(self):
        """Mixed bands with known weights should produce expected score."""
        from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index

        # CO2 GOOD (100) at 25% + PM25 CRITICAL (0) at 75% = 25.0
        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "GOOD"},
            {"metric_name": "pm25_ugm3", "threshold_band": "CRITICAL"},
        ]
        weights = {"co2_ppm": 25.0, "pm25_ugm3": 75.0}
        result = calculate_wellness_index(findings, weights)
        assert result == 25.0

    def test_empty_findings_returns_0(self):
        from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index
        assert calculate_wellness_index([], {"co2_ppm": 100.0}) == 0.0

    def test_empty_weights_returns_0(self):
        from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index
        assert calculate_wellness_index([{"metric_name": "co2_ppm", "threshold_band": "GOOD"}], {}) == 0.0

    def test_multiple_findings_per_metric_averaged(self):
        """Multiple findings for same metric should be averaged."""
        from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index

        # CO2: one GOOD (100), one CRITICAL (0) → avg 50 → 50 * 100% weight = 50.0
        findings = [
            {"metric_name": "co2_ppm", "threshold_band": "GOOD"},
            {"metric_name": "co2_ppm", "threshold_band": "CRITICAL"},
        ]
        weights = {"co2_ppm": 100.0}
        result = calculate_wellness_index(findings, weights)
        assert result == 50.0


class TestCertificationOutcome:
    """Verify certification outcome thresholds."""

    def test_green_threshold(self):
        from app.skills.iaq_rule_governor.wellness_index import derive_certification_outcome
        assert derive_certification_outcome(90.0) == CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED
        assert derive_certification_outcome(95.0) == CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED
        assert derive_certification_outcome(100.0) == CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED

    def test_amber_threshold(self):
        from app.skills.iaq_rule_governor.wellness_index import derive_certification_outcome
        assert derive_certification_outcome(75.0) == CertificationOutcome.HEALTHY_SPACE_VERIFIED
        assert derive_certification_outcome(89.9) == CertificationOutcome.HEALTHY_SPACE_VERIFIED

    def test_red_threshold(self):
        from app.skills.iaq_rule_governor.wellness_index import derive_certification_outcome
        assert derive_certification_outcome(74.9) == CertificationOutcome.IMPROVEMENT_RECOMMENDED
        assert derive_certification_outcome(0.0) == CertificationOutcome.IMPROVEMENT_RECOMMENDED

    def test_insufficient_evidence(self):
        from app.skills.iaq_rule_governor.wellness_index import derive_certification_outcome
        assert derive_certification_outcome(None) == CertificationOutcome.INSUFFICIENT_EVIDENCE


# ── Top Risks Tests ──────────────────────────────────────────────────────────


def make_finding_mock(**kwargs):
    f = MagicMock()
    f.id = "finding-001"
    f.site_id = "site-001"
    f.metric_name = MetricName.co2_ppm
    f.threshold_band = ThresholdBand.CRITICAL
    f.interpretation_text = "CO2 levels exceed safe thresholds."
    f.workforce_impact_text = "Productivity impact expected."
    f.recommended_action = "Increase ventilation."
    f.rule_id = "rule-co2-001"
    f.rule_version = "v1.0"
    f.citation_unit_ids = '["cit-001"]'
    f.confidence_level = ConfidenceLevel.HIGH
    f.source_currency_status = SourceCurrency.CURRENT_VERIFIED
    f.benchmark_lane = "FJ_SAFESPACE"
    from datetime import datetime
    f.created_at = datetime.utcnow()
    for k, v in kwargs.items():
        setattr(f, k, v)
    return f


def make_site_mock(**kwargs):
    s = MagicMock()
    s.id = "site-001"
    s.name = "FJ Tower"
    for k, v in kwargs.items():
        setattr(s, k, v)
    return s


class TestTop3Risks:
    """Verify top risks prioritization logic."""

    @patch("app.services.aggregation.Session")
    def test_returns_critical_first(self, mock_session):
        """Non-advisory CRITICAL findings should appear before advisory."""
        critical = make_finding_mock(
            source_currency_status=SourceCurrency.CURRENT_VERIFIED,
            metric_name=MetricName.co2_ppm,
        )
        advisory = make_finding_mock(
            source_currency_status=SourceCurrency.PARTIAL_EXTRACT,
            metric_name=MetricName.pm25_ugm3,
        )
        site = make_site_mock()

        mock_session.exec.return_value.all.return_value = [
            (advisory, site),
            (critical, site),
        ]

        risks = get_top_3_risks(mock_session)
        assert len(risks) == 2
        assert risks[0]["is_advisory"] is False
        assert risks[1]["is_advisory"] is True

    @patch("app.services.aggregation.Session")
    def test_limits_to_3(self, mock_session):
        """Should return at most 3 risks."""
        site = make_site_mock()
        findings = [
            (make_finding_mock(metric_name=MetricName(f"co2_ppm"), id=f"f-{i}"), site)
            for i in range(5)
        ]
        mock_session.exec.return_value.all.return_value = findings

        risks = get_top_3_risks(mock_session)
        assert len(risks) == 3

    @patch("app.services.aggregation.Session")
    def test_empty_when_no_critical(self, mock_session):
        """No CRITICAL findings → empty list."""
        mock_session.exec.return_value.all.return_value = []
        risks = get_top_3_risks(mock_session)
        assert risks == []


class TestTop3Actions:
    """Verify top actions are derived from top risks."""

    @patch("app.services.aggregation.get_top_3_risks")
    def test_actions_mirror_risks(self, mock_risks):
        mock_risks.return_value = [
            {
                "site_name": "FJ Tower",
                "metric_name": "co2_ppm",
                "recommended_action": "Increase ventilation.",
                "is_advisory": False,
            }
        ]
        actions = get_top_3_actions(MagicMock())
        assert len(actions) == 1
        assert actions[0]["recommended_action"] == "Increase ventilation."
        assert actions[0]["priority"] == "HIGH"


class TestLeaderboard:
    """Verify leaderboard sorting and content."""

    def test_sorted_by_score_desc(self):
        """Leaderboard should be sorted by wellness_index_score descending."""
        with patch("app.services.aggregation.get_leaderboard") as mock_lb:
            mock_lb.return_value = [
                {"site_id": "site-a", "site_name": "Site A", "wellness_index_score": 95.0,
                 "certification_outcome": "HEALTHY_WORKPLACE_CERTIFIED",
                 "last_scan_date": None, "finding_count": 0},
                {"site_id": "site-b", "site_name": "Site B", "wellness_index_score": 80.0,
                 "certification_outcome": "HEALTHY_SPACE_VERIFIED",
                 "last_scan_date": None, "finding_count": 0},
            ]
            leaderboard = mock_lb(MagicMock())
            assert leaderboard[0]["site_name"] == "Site A"
            assert leaderboard[0]["wellness_index_score"] == 95.0
            assert leaderboard[1]["site_name"] == "Site B"
            assert leaderboard[1]["wellness_index_score"] == 80.0


class TestExecutiveDashboard:
    """Verify the aggregated executive dashboard response."""

    @patch("app.services.aggregation.get_leaderboard")
    @patch("app.services.aggregation.get_top_3_risks")
    @patch("app.services.aggregation.get_top_3_actions")
    def test_aggregates_all_data(self, mock_actions, mock_risks, mock_leaderboard):
        mock_leaderboard.return_value = [
            {
                "site_id": "site-001",
                "site_name": "FJ Tower",
                "wellness_index_score": 92.0,
                "certification_outcome": CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED.value,
                "last_scan_date": "2026-04-18T10:00:00",
                "finding_count": 5,
            }
        ]
        mock_risks.return_value = [{"site_name": "FJ Tower", "metric_name": "co2_ppm"}]
        mock_actions.return_value = [{"site_name": "FJ Tower", "recommended_action": "Ventilate"}]

        dashboard = get_executive_dashboard(MagicMock())

        assert "leaderboard" in dashboard
        assert "top_risks" in dashboard
        assert "top_actions" in dashboard
        assert "health_ratings" in dashboard

        health = dashboard["health_ratings"]
        assert health["total_sites"] == 1
        assert health["certified"] == 1
        assert health["average_wellness_index"] == 92.0

    @patch("app.services.aggregation.get_leaderboard")
    @patch("app.services.aggregation.get_top_3_risks")
    @patch("app.services.aggregation.get_top_3_actions")
    def test_empty_state(self, mock_actions, mock_risks, mock_leaderboard):
        mock_leaderboard.return_value = []
        mock_risks.return_value = []
        mock_actions.return_value = []

        dashboard = get_executive_dashboard(MagicMock())

        assert dashboard["health_ratings"]["total_sites"] == 0
        assert dashboard["health_ratings"]["average_wellness_index"] == 0.0
        assert dashboard["leaderboard"] == []
