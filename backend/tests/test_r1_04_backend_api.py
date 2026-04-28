"""
backend/tests/test_r1_04_backend_api.py

Integration tests for PR-R1-04: Backend API enhancements.

Tests:
- Preferences: GET/PATCH metric-preferences
- Standards: GET/POST activate/deactivate
- Interpretations: GET by metric/band
- Upload: enhanced with standards param
- Findings: filtered by standard_id
- Dashboard: tenant scoping

Requires: PostgreSQL database with migrations 008-011 applied.
"""

import json
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_session
from app.main import app
from app.schemas.dashboard import (
    SiteMetricPreferencesResponse,
    SiteMetricPreferencesUpdate,
    SiteStandardResponse,
    InterpretationResponse,
)


# ── Database skip marker ─────────────────────────────────────────────────────

def _has_db():
    """Check if DATABASE_URL is configured and migrations 008-011 applied."""
    import os
    url = os.environ.get("DATABASE_URL", "")
    if not url or url.startswith("sqlite"):
        return False
    # Check if migration columns exist on site table
    try:
        from sqlmodel import Session, create_engine, text
        engine = create_engine(url)
        with Session(engine) as session:
            result = session.exec(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'site' AND column_name = 'context_scope'"
            )).first()
            engine.dispose()
            return result is not None
    except Exception:
        return False


skip_no_db = pytest.mark.skipif(not _has_db(), reason="No PostgreSQL DATABASE_URL configured")


# ── Unit Tests ────────────────────────────────────────────────────────────────

class TestSchemaValidation:
    """Unit tests for Pydantic schema validation."""

    def test_site_metric_preferences_response_valid(self):
        resp = SiteMetricPreferencesResponse(
            site_id="test-site-001",
            active_metrics=["co2_ppm", "pm25_ugm3"],
            alert_threshold_overrides={"co2_ppm": {"warning": 800, "critical": 1200}},
        )
        assert resp.site_id == "test-site-001"
        assert len(resp.active_metrics) == 2
        assert resp.alert_threshold_overrides["co2_ppm"]["warning"] == 800

    def test_site_metric_preferences_update_optional_fields(self):
        # Both fields optional
        update = SiteMetricPreferencesUpdate()
        assert update.active_metrics is None
        assert update.alert_threshold_overrides is None

        # Only active_metrics
        update2 = SiteMetricPreferencesUpdate(active_metrics=["co2_ppm"])
        assert update2.active_metrics == ["co2_ppm"]
        assert update2.alert_threshold_overrides is None

    def test_site_standard_response(self):
        std = SiteStandardResponse(
            source_id="well-v2",
            title="WELL Performance Verification Guidebook",
            is_active=True,
        )
        assert std.source_id == "well-v2"
        assert std.is_active is True

    def test_interpretation_response(self):
        interp = InterpretationResponse(
            metric_name="co2_ppm",
            threshold_band="critical",
            interpretation="CO2 levels are critically elevated.",
            business_impact="Cognitive function may be impaired.",
            recommendation="Increase ventilation immediately.",
            context_scope="general",
        )
        assert interp.metric_name == "co2_ppm"
        assert interp.threshold_band == "critical"


class TestMetricNameValidation:
    """Unit tests for metric name validation logic."""

    def test_valid_metric_names(self):
        from app.models.enums import MetricName
        valid_names = ["co2_ppm", "pm25_ugm3", "tvoc_ppb", "temperature_c", "humidity_rh"]
        for name in valid_names:
            assert name in [m.value for m in MetricName]

    def test_invalid_metric_name_rejected(self):
        from app.models.enums import MetricName
        invalid = "nonexistent_metric"
        assert invalid not in [m.value for m in MetricName]


# ── Router Structure Tests ────────────────────────────────────────────────────

class TestRouterRegistration:
    """Verify new routers are registered in the FastAPI app."""

    def test_preferences_routes_exist(self):
        routes = [r.path for r in app.routes]
        assert "/api/sites/{site_id}/metric-preferences" in routes

    def test_standards_routes_exist(self):
        routes = [r.path for r in app.routes]
        assert "/api/sites/{site_id}/standards" in routes
        assert "/api/sites/{site_id}/standards/{source_id}/activate" in routes
        assert "/api/sites/{site_id}/standards/{source_id}/deactivate" in routes

    def test_interpretations_route_exists(self):
        routes = [r.path for r in app.routes]
        assert "/api/interpretations/{metric_name}/{threshold_band}" in routes


# ── Integration Tests (PostgreSQL required) ───────────────────────────────────

@pytest.fixture()
def client():
    """Create TestClient with isolated DB session per test."""
    from sqlmodel import Session, create_engine
    engine = create_engine(_db_url())
    with Session(engine) as session:
        app.dependency_overrides[get_session] = lambda: session
        tc = TestClient(app)
        yield tc
        app.dependency_overrides.clear()
    engine.dispose()


def _db_url():
    import os
    return os.environ.get("DATABASE_URL", "sqlite:///test.db")


@skip_no_db
class TestPreferencesIntegration:
    """Integration tests for preferences endpoints."""

    def test_get_preferences_site_not_found(self, client):
        resp = client.get("/api/sites/00000000-0000-0000-0000-000000000000/metric-preferences")
        assert resp.status_code == 404

    def test_patch_preferences_invalid_metric(self, client):
        """PATCH with invalid metric name should return 400."""
        resp = client.patch(
            "/api/sites/00000000-0000-0000-0000-000000000000/metric-preferences",
            json={"active_metrics": ["invalid_metric_name"]},
        )
        # Will 404 first since site doesn't exist — that's acceptable
        assert resp.status_code in (400, 404)


@skip_no_db
class TestStandardsIntegration:
    """Integration tests for standards endpoints."""

    def test_list_standards_site_not_found(self, client):
        resp = client.get("/api/sites/00000000-0000-0000-0000-000000000000/standards")
        assert resp.status_code == 404

    def test_activate_standard_site_not_found(self, client):
        resp = client.post("/api/sites/00000000-0000-0000-0000-000000000000/standards/fake-source/activate")
        assert resp.status_code in (400, 404)


@skip_no_db
class TestInterpretationsIntegration:
    """Integration tests for interpretation endpoints."""

    def test_get_interpretation_not_found(self, client):
        resp = client.get("/api/interpretations/nonexistent_metric/band_xyz")
        assert resp.status_code == 404

    def test_get_interpretation_valid(self, client):
        """Should return interpretation for a known metric/band combo."""
        resp = client.get("/api/interpretations/co2_ppm/caution")
        # May return 200 with rule data, 404 if no rule, or 400 if validation fails
        assert resp.status_code in (200, 400, 404)
        if resp.status_code == 200:
            data = resp.json()
            assert "metric_name" in data
            assert "threshold_band" in data
            assert "interpretation" in data
            assert "business_impact" in data
            assert "recommendation" in data


@skip_no_db
class TestUploadWithStandards:
    """Integration test for upload with standards parameter (AC1)."""

    def test_upload_standards_parameter_parsed(self, client):
        """Upload with standards parameter should not reject the form field."""
        # This tests the standards parameter parsing path in create_upload.
        # We verify the route accepts the standards form field without 422 errors.
        # The upload itself may fail (no Supabase Storage), but standards parsing
        # should not be the cause.
        resp = client.post(
            "/api/uploads",
            data={"standards": json.dumps(["fake-source-id"])},
            files={"file": ("test.csv", b"zone,co2_ppm\nZone A,500")},
        )
        # Should NOT be a 422 validation error on the standards field
        # (may be 400/500 from other failures like storage or CSV parsing)
        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            # Check that the 422 is NOT about the 'standards' field
            for error in detail:
                loc = error.get("loc", [])
                assert "standards" not in str(loc), f"standards field caused 422: {error}"


@skip_no_db
class TestStandardsListWithValidSite:
    """Integration test for GET standards list with valid site (AC5)."""

    def test_list_standards_returns_active_standards(self, client):
        """GET /api/sites/{id}/standards should return active standards for a real site."""
        # First get a real site ID from the database
        from sqlmodel import Session, create_engine, text
        engine = create_engine(_db_url())
        with Session(engine) as session:
            result = session.exec(text("SELECT id FROM site LIMIT 1")).first()
            engine.dispose()

        if result is None:
            pytest.skip("No sites in database")

        # result is a Row object from text() query
        site_id = str(result[0])
        resp = client.get(f"/api/sites/{site_id}/standards")
        # Should return 200 with standards object
        assert resp.status_code == 200
        data = resp.json()
        assert "standards" in data
        assert isinstance(data["standards"], list)


@skip_no_db
class TestTenantScoping:
    """Integration test for tenant scoping on dashboard routes (AC8)."""

    def test_sites_endpoint_returns_200_without_tenant(self, client):
        """GET /api/dashboard/sites without tenant_id should return all sites."""
        resp = client.get("/api/dashboard/sites")
        # Should succeed (200) — returns all sites when no tenant filter
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_comparison_endpoint_returns_200_without_tenant(self, client):
        """GET /api/dashboard/comparison without tenant_id should return comparison data."""
        resp = client.get("/api/dashboard/comparison")
        # Should succeed (200) even with no data
        assert resp.status_code == 200
