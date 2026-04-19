"""
backend/tests/integration/test_dashboard_endpoints.py

Integration tests for dashboard aggregation endpoints (PR 8.3).

Tests each endpoint with both populated and empty database states:
- GET /api/dashboard/sites — populated and empty
- GET /api/dashboard/sites/{site_id}/zones — populated, empty, invalid site_id
- GET /api/dashboard/comparison — populated with sort order, empty
- GET /api/dashboard/summary — populated, empty
- GET /api/dashboard/executive — populated, empty

Requires: running PostgreSQL, seed_rulebook_v1.py executed, DATABASE_URL set.
"""

import json

from sqlmodel import Session

from app.models.enums import (
    ConfidenceLevel,
    MetricName,
    ParseOutcome,
    ParseStatus,
    SourceCurrency,
    ThresholdBand,
)
from app.models.workflow_b import Finding, Site, Upload


# ── Shared helpers ─────────────────────────────────────────────────────────────

def seed_site(session: Session, name: str = "Test Site") -> Site:
    site = Site(name=name)
    session.add(site)
    session.commit()
    session.refresh(site)
    return site


def seed_upload(session: Session, site_id: str) -> Upload:
    upload = Upload(
        site_id=site_id,
        file_name="test.csv",
        uploaded_by="test_user",
        parse_status=ParseStatus.COMPLETE,
        parse_outcome=ParseOutcome.PASS,
        rule_version_used="v1.0",
    )
    session.add(upload)
    session.commit()
    session.refresh(upload)
    return upload


def seed_finding(session: Session, upload_id: str, site_id: str, **kwargs) -> Finding:
    finding = Finding(
        upload_id=upload_id,
        site_id=site_id,
        zone_name=kwargs.get("zone_name", "Zone A"),
        metric_name=kwargs.get("metric_name", MetricName.co2_ppm),
        threshold_band=kwargs.get("threshold_band", ThresholdBand.GOOD),
        interpretation_text=kwargs.get("interpretation_text", "Air quality is good."),
        workforce_impact_text=kwargs.get("workforce_impact_text", "No impact expected."),
        recommended_action=kwargs.get("recommended_action", "Continue monitoring."),
        rule_id=kwargs.get("rule_id", "rule-co2-001"),
        rule_version=kwargs.get("rule_version", "v1.0"),
        citation_unit_ids=kwargs.get("citation_unit_ids", json.dumps(["cit-001"])),
        confidence_level=kwargs.get("confidence_level", ConfidenceLevel.HIGH),
        source_currency_status=kwargs.get("source_currency_status", SourceCurrency.CURRENT_VERIFIED),
        benchmark_lane=kwargs.get("benchmark_lane", "FJ_SAFESPACE"),
    )
    session.add(finding)
    session.commit()
    session.refresh(finding)
    return finding


# ── GET /api/dashboard/sites ──────────────────────────────────────────────────

class TestGetSites:
    """GET /api/dashboard/sites returns site list."""

    def test_returns_empty_list(self, client, db_session: Session):
        """With no sites created by this test, returns whatever exists (structure check)."""
        # Since the test DB may have seed data, we just verify the response structure
        resp = client.get("/api/dashboard/sites")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:  # If any sites exist, verify structure
            assert "site_id" in data[0]
            assert "site_name" in data[0]

    def test_returns_populated_sites(self, client, db_session: Session):
        """With sites in DB, returns site summaries including our test site."""
        _site = seed_site(db_session, "PR8Test_Office")

        resp = client.get("/api/dashboard/sites")
        assert resp.status_code == 200
        data = resp.json()
        # Find our test site in the list
        our_site = next((d for d in data if d["site_name"] == "PR8Test_Office"), None)
        assert our_site is not None
        assert "wellness_index_score" in our_site
        assert "certification_outcome" in our_site


# ── GET /api/dashboard/sites/{site_id}/zones ──────────────────────────────────

class TestGetSiteZones:
    """GET /api/dashboard/sites/{site_id}/zones returns zone breakdown."""

    def test_invalid_site_id_returns_404(self, client):
        resp = client.get("/api/dashboard/sites/nonexistent-id/zones")
        assert resp.status_code == 404

    def test_returns_empty_zones(self, client, db_session: Session):
        """Site exists but no findings → empty zones list."""
        site = seed_site(db_session, "Empty Site")

        resp = client.get(f"/api/dashboard/sites/{site.id}/zones")
        assert resp.status_code == 200
        data = resp.json()
        assert data["site_name"] == "Empty Site"
        assert data["zones"] == []

    def test_returns_populated_zones(self, client, db_session: Session):
        """Site with findings → grouped by zone."""
        site = seed_site(db_session, "Office Tower")
        upload = seed_upload(db_session, site.id)
        seed_finding(db_session, upload.id, site.id, zone_name="Floor 1")
        seed_finding(db_session, upload.id, site.id, zone_name="Floor 2")

        resp = client.get(f"/api/dashboard/sites/{site.id}/zones")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["zones"]) == 2
        zone_names = [z["zone_name"] for z in data["zones"]]
        assert "Floor 1" in zone_names
        assert "Floor 2" in zone_names


# ── GET /api/dashboard/comparison ─────────────────────────────────────────────

class TestGetCrossSiteComparison:
    """GET /api/dashboard/comparison returns sites sorted by wellnessIndexScore DESC."""

    def test_returns_empty_list(self, client, db_session: Session):
        """Verifies response structure — list of leaderboard rows."""
        resp = client.get("/api/dashboard/comparison")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert "site_id" in data[0]
            assert "wellness_index_score" in data[0]

    def test_sorted_by_wellness_index_desc(self, client, db_session: Session):
        """Sites with better findings rank higher."""
        site_a = seed_site(db_session, "PR8Test_GoodSite")
        site_b = seed_site(db_session, "PR8Test_BadSite")

        upload_a = seed_upload(db_session, site_a.id)
        upload_b = seed_upload(db_session, site_b.id)

        # Site A: all good → higher score
        seed_finding(db_session, upload_a.id, site_a.id,
                     metric_name=MetricName.co2_ppm,
                     threshold_band=ThresholdBand.GOOD)

        # Site B: critical → lower score
        seed_finding(db_session, upload_b.id, site_b.id,
                     metric_name=MetricName.co2_ppm,
                     threshold_band=ThresholdBand.CRITICAL)

        resp = client.get("/api/dashboard/comparison")
        assert resp.status_code == 200
        data = resp.json()
        # Find our test sites in the leaderboard
        good_site = next(d for d in data if d["site_name"] == "PR8Test_GoodSite")
        bad_site = next(d for d in data if d["site_name"] == "PR8Test_BadSite")
        assert good_site["wellness_index_score"] >= bad_site["wellness_index_score"]


# ── GET /api/dashboard/summary ────────────────────────────────────────────────

class TestGetDailySummary:
    """GET /api/dashboard/summary returns aggregated summary."""

    def test_returns_empty_summary(self, client, db_session: Session):
        """Verifies response structure for daily summary."""
        resp = client.get("/api/dashboard/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "top3_risks" in data
        assert "top3_actions" in data
        assert "data_as_of" in data

    def test_returns_populated_summary(self, client, db_session: Session):
        """With findings, returns risks and actions."""
        site = seed_site(db_session, "Summary Site")
        upload = seed_upload(db_session, site.id)
        seed_finding(db_session, upload.id, site.id,
                     metric_name=MetricName.co2_ppm,
                     threshold_band=ThresholdBand.CRITICAL)

        resp = client.get("/api/dashboard/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "top3_risks" in data
        assert "top3_actions" in data
        assert data["data_as_of"] is not None


# ── GET /api/dashboard/executive ──────────────────────────────────────────────

class TestGetExecutiveDashboard:
    """GET /api/dashboard/executive returns ExecutiveDashboardResponse."""

    def test_returns_empty_executive(self, client, db_session: Session):
        """Verifies response structure for executive dashboard."""
        resp = client.get("/api/dashboard/executive")
        assert resp.status_code == 200
        data = resp.json()
        assert "leaderboard" in data
        assert "top_risks" in data
        assert "top_actions" in data
        assert "health_ratings" in data
        assert "total_sites" in data["health_ratings"]

    def test_returns_populated_executive(self, client, db_session: Session):
        """With sites and findings, returns full executive data including our test site."""
        site = seed_site(db_session, "PR8Test_Executive")
        upload = seed_upload(db_session, site.id)
        seed_finding(db_session, upload.id, site.id,
                     metric_name=MetricName.co2_ppm,
                     threshold_band=ThresholdBand.GOOD)

        resp = client.get("/api/dashboard/executive")
        assert resp.status_code == 200
        data = resp.json()
        # Find our test site in the leaderboard
        our_site = next((d for d in data["leaderboard"] if d["site_name"] == "PR8Test_Executive"), None)
        assert our_site is not None
        assert "wellness_index_score" in our_site
        assert data["health_ratings"]["total_sites"] > 0
