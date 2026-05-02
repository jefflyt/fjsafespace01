"""
backend/tests/test_preference_api.py

Integration tests for the preference API endpoints.

Tests:
- GET metric-preferences → returns 200 with correct data
- PATCH with valid data → updates, returns 200
- PATCH with invalid metric name → returns 400
- PATCH with threshold outside rulebook bounds → returns 400
- PATCH on non-existent site → returns 404

Requires: PostgreSQL database with migrations applied.
"""

import os

import pytest


def _has_pg():
    url = os.environ.get("DATABASE_URL", "")
    return url.startswith("postgresql")


skip_no_db = pytest.mark.skipif(not _has_pg(), reason="No PostgreSQL DATABASE_URL configured")


@skip_no_db
class TestGetPreferences:
    """GET /api/sites/{id}/metric-preferences tests."""

    def test_get_preferences_returns_200(self, client, seed_data):
        """GET preferences for existing site returns 200."""
        resp = client.get(f"/api/sites/{seed_data['site_id']}/metric-preferences")
        assert resp.status_code == 200

    def test_get_preferences_returns_site_id(self, client, seed_data):
        """Response includes site_id matching the requested site."""
        resp = client.get(f"/api/sites/{seed_data['site_id']}/metric-preferences")
        data = resp.json()
        assert data["site_id"] == seed_data["site_id"]

    def test_get_preferences_default_empty(self, client, seed_data):
        """Site with no preferences returns empty active_metrics and alert_threshold_overrides."""
        resp = client.get(f"/api/sites/{seed_data['site_id']}/metric-preferences")
        data = resp.json()
        assert data["active_metrics"] == []
        assert data["alert_threshold_overrides"] == {}

    def test_get_preferences_site_not_found(self, client):
        """GET preferences for non-existent site returns 404."""
        resp = client.get("/api/sites/00000000-0000-0000-0000-000000000000/metric-preferences")
        assert resp.status_code == 404


@skip_no_db
class TestUpdatePreferences:
    """PATCH /api/sites/{id}/metric-preferences tests."""

    def test_patch_valid_metrics(self, client, seed_data):
        """PATCH with valid metric names returns 200 with updated prefs."""
        resp = client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"active_metrics": ["co2_ppm", "pm25_ugm3"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "co2_ppm" in data["active_metrics"]
        assert "pm25_ugm3" in data["active_metrics"]

    def test_patch_invalid_metric_name(self, client, seed_data):
        """PATCH with invalid metric name returns 400."""
        resp = client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"active_metrics": ["nonexistent_metric"]},
        )
        assert resp.status_code == 400
        assert "Invalid metric name" in resp.json()["detail"]

    def test_patch_nonexistent_site(self, client):
        """PATCH preferences for non-existent site returns 404."""
        resp = client.patch(
            "/api/sites/00000000-0000-0000-0000-000000000000/metric-preferences",
            json={"active_metrics": ["co2_ppm"]},
        )
        assert resp.status_code == 404

    def test_patch_invalid_threshold_value(self, client, seed_data):
        """PATCH with non-numeric threshold value returns 400."""
        resp = client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"alert_threshold_overrides": {"co2_ppm": {"watch_max": "not-a-number"}}},
        )
        assert resp.status_code == 400

    def test_patch_invalid_threshold_metric(self, client, seed_data):
        """PATCH with invalid metric in threshold overrides returns 400."""
        resp = client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"alert_threshold_overrides": {"fake_metric": {"watch_max": 500}}},
        )
        assert resp.status_code == 400

    def test_patch_updates_and_persists(self, client, seed_data):
        """PATCH then GET should return the updated values."""
        # Update
        client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"active_metrics": ["temperature_c", "humidity_rh"]},
        )
        # Verify
        resp = client.get(f"/api/sites/{seed_data['site_id']}/metric-preferences")
        data = resp.json()
        assert "temperature_c" in data["active_metrics"]
        assert "humidity_rh" in data["active_metrics"]

    def test_patch_partial_update(self, client, seed_data):
        """PATCH with only active_metrics should not reset alert_threshold_overrides."""
        # First set both fields
        client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={
                "active_metrics": ["co2_ppm"],
                "alert_threshold_overrides": {"co2_ppm": {"watch_max": 900}},
            },
        )
        # Then update only active_metrics
        client.patch(
            f"/api/sites/{seed_data['site_id']}/metric-preferences",
            json={"active_metrics": ["co2_ppm", "pm25_ugm3"]},
        )
        # Verify thresholds were preserved
        resp = client.get(f"/api/sites/{seed_data['site_id']}/metric-preferences")
        data = resp.json()
        assert "co2_ppm" in data["alert_threshold_overrides"]
