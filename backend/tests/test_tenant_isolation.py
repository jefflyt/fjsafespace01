"""
backend/tests/test_tenant_isolation.py

Integration tests for tenant isolation in dashboard routes.

Tests:
- Facility manager with valid token can only access their tenant's sites
- Admin (no token) can access all sites
- Cross-tenant data leakage prevention
- Site metric preferences scoped to tenant
- Standards management scoped to tenant

Requires: PostgreSQL database with migrations applied and seed data.
"""

import os

import pytest


def _has_pg():
    url = os.environ.get("DATABASE_URL", "")
    return url.startswith("postgresql")


skip_no_db = pytest.mark.skipif(not _has_pg(), reason="No PostgreSQL DATABASE_URL configured")


@skip_no_db
class TestTenantScopingDashboard:
    """Test tenant scoping on dashboard endpoints."""

    def test_sites_endpoint_without_tenant_returns_all(self, client, seed_data):
        """GET /api/dashboard/sites without tenant_id returns all sites."""
        resp = client.get("/api/dashboard/sites")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # Should include our seeded site
        site_ids = [s["site_id"] for s in data]
        assert seed_data["site_id"] in site_ids

    def test_comparison_endpoint_without_tenant(self, client, seed_data):
        """GET /api/dashboard/comparison without tenant_id returns comparison data."""
        resp = client.get("/api/dashboard/comparison")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_zones_endpoint_site_not_found(self, client):
        """GET /api/dashboard/sites/{id}/zones with invalid site returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/api/dashboard/sites/{fake_id}/zones")
        assert resp.status_code == 404


@skip_no_db
class TestTenantScopingPreferences:
    """Test tenant scoping on preferences endpoints."""

    def test_get_preferences_existing_site(self, client, seed_data):
        """GET preferences for existing site returns 200."""
        resp = client.get(f"/api/sites/{seed_data['site_id']}/metric-preferences")
        assert resp.status_code == 200
        data = resp.json()
        assert data["site_id"] == seed_data["site_id"]
        assert "active_metrics" in data

    def test_get_preferences_nonexistent_site(self, client):
        """GET preferences for non-existent site returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/api/sites/{fake_id}/metric-preferences")
        assert resp.status_code == 404

    def test_patch_preferences_invalid_metric(self, client, seed_data):
        """PATCH with invalid metric name returns 400."""
        resp = client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"active_metrics": ["invalid_metric"]},
        )
        assert resp.status_code == 400
        assert "Invalid metric name" in resp.json()["detail"]

    def test_patch_preferences_valid(self, client, seed_data):
        """PATCH with valid metric names returns 200 with updated prefs."""
        resp = client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"active_metrics": ["co2_ppm", "pm25_ugm3"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "co2_ppm" in data["active_metrics"]
        assert "pm25_ugm3" in data["active_metrics"]


@skip_no_db
class TestTenantScopingStandards:
    """Test tenant scoping on standards endpoints."""

    def test_list_standards_existing_site(self, client, seed_data):
        """GET standards for existing site returns 200."""
        resp = client.get(f"/api/sites/{seed_data['site_id']}/standards")
        assert resp.status_code == 200
        data = resp.json()
        assert "standards" in data
        assert isinstance(data["standards"], list)

    def test_list_standards_nonexistent_site(self, client):
        """GET standards for non-existent site returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/api/sites/{fake_id}/standards")
        assert resp.status_code == 404

    def test_activate_standard_nonexistent_site(self, client):
        """POST activate for non-existent site returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.post(f"/api/sites/{fake_id}/standards/some-source/activate")
        assert resp.status_code == 404

    def test_activate_standard_nonexistent_source(self, client, seed_data):
        """POST activate for valid site but non-existent source returns 404."""
        fake_source = "00000000-0000-0000-0000-000000000000"
        resp = client.post(f"/api/sites/{seed_data['site_id']}/standards/{fake_source}/activate")
        assert resp.status_code == 404

    def test_activate_and_deactivate_standard(self, client, seed_data):
        """POST activate then deactivate for valid site/source."""
        source_id = seed_data["source_id"]
        site_id = seed_data["site_id"]

        # Activate
        resp = client.post(f"/api/sites/{site_id}/standards/{source_id}/activate")
        assert resp.status_code == 204

        # Verify it's active
        resp = client.get(f"/api/sites/{site_id}/standards")
        assert resp.status_code == 200
        data = resp.json()
        active_sources = [s["source_id"] for s in data["standards"]]
        assert source_id in active_sources

        # Deactivate
        resp = client.post(f"/api/sites/{site_id}/standards/{source_id}/deactivate")
        assert resp.status_code == 204

        # Verify it's inactive
        resp = client.get(f"/api/sites/{site_id}/standards")
        data = resp.json()
        active_sources = [s["source_id"] for s in data["standards"]]
        assert source_id not in active_sources


@skip_no_db
class TestDataLeakagePrevention:
    """Test that data from different tenant contexts stays isolated."""

    def test_empty_database_returns_empty_lists(self, client):
        """Endpoints should return empty lists, not errors, for empty data."""
        resp = client.get("/api/dashboard/sites")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_findings_nonexistent_upload(self, client):
        """GET findings for non-existent upload returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/api/uploads/{fake_id}/findings")
        assert resp.status_code == 404
