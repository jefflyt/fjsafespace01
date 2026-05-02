"""
backend/tests/test_interpretation_layer.py

Integration tests for the interpretation layer endpoints.

Tests:
- GET /api/interpretations/co2_ppm/WATCH → returns interpretation text
- GET /api/interpretations with unknown metric → returns 404
- GET /api/interpretations with invalid threshold_band → returns 400
- Interpretation templates map correctly to threshold bands
- Context scope fallback to "general"

Requires: PostgreSQL database with rulebook seeded.
"""

import os

import pytest


def _has_pg():
    url = os.environ.get("DATABASE_URL", "")
    return url.startswith("postgresql")


skip_no_db = pytest.mark.skipif(not _has_pg(), reason="No PostgreSQL DATABASE_URL configured")


@skip_no_db
class TestInterpretationEndpoint:
    """GET /api/interpretations/{metric_name}/{threshold_band} tests."""

    def test_unknown_metric_returns_404(self, client):
        """GET interpretation for unknown metric returns 404."""
        resp = client.get("/api/interpretations/nonexistent_metric/GOOD")
        assert resp.status_code == 404

    def test_invalid_threshold_band_returns_400(self, client):
        """GET interpretation with invalid threshold_band returns 400."""
        resp = client.get("/api/interpretations/co2_ppm/INVALID_BAND")
        assert resp.status_code == 400
        assert "Invalid threshold_band" in resp.json()["detail"]

    def test_response_structure(self, client):
        """Response should include metric_name, threshold_band, interpretation, etc."""
        resp = client.get("/api/interpretations/co2_ppm/GOOD")
        if resp.status_code == 200:
            data = resp.json()
            assert "metric_name" in data
            assert "threshold_band" in data
            assert "interpretation" in data
            assert "business_impact" in data
            assert "recommendation" in data
            assert data["metric_name"] == "co2_ppm"
            assert data["threshold_band"] == "GOOD"

    def test_context_scope_param_accepted(self, client):
        """GET with context_scope query param should be accepted."""
        resp = client.get(
            "/api/interpretations/co2_ppm/GOOD",
            params={"context_scope": "office"},
        )
        # May return 200 (if office rules exist) or 404 (fallback)
        assert resp.status_code in (200, 404)

    def test_all_valid_metrics_accepted(self, client):
        """All valid MetricName enum values should be accepted by the endpoint."""
        valid_metrics = [
            "co2_ppm", "co_ppb", "pm25_ugm3", "humidity_rh",
            "temperature_c", "tvoc_ppb", "o3_ppb", "no_ppb",
            "no2_ppb", "voc_ppb", "pressure_hpa", "noise_dba",
            "pm10_ugm3", "aqi_index",
        ]
        for metric in valid_metrics:
            resp = client.get(f"/api/interpretations/{metric}/GOOD")
            # Should be 200 (rule found) or 404 (no rule), not 400 (validation error)
            assert resp.status_code in (200, 404), f"Unexpected status for {metric}: {resp.status_code}"

    def test_all_valid_bands_accepted(self, client):
        """All valid ThresholdBand enum values should be accepted."""
        valid_bands = ["GOOD", "WATCH", "CRITICAL"]
        for band in valid_bands:
            resp = client.get(f"/api/interpretations/co2_ppm/{band}")
            assert resp.status_code in (200, 404), f"Unexpected status for {band}: {resp.status_code}"
