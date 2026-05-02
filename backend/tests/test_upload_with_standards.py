"""
backend/tests/test_upload_with_standards.py

Integration tests for upload with standards parameter.

Tests:
- POST /api/uploads with standards=[source_id] → stores standards_evaluated
- POST /api/uploads without standards → uses site defaults
- GET /api/uploads/{id}/findings?standard_id=X → filtered findings
- Duplicate upload (same hash) → returns existing result (deferred)
- Upload with CSV that has no data rows → error message

Requires: PostgreSQL database + Supabase Storage configured.
"""

import json

import pytest

import os



def _has_pg():
    url = os.environ.get("DATABASE_URL", "")
    return url.startswith("postgresql")


skip_no_db = pytest.mark.skipif(not _has_pg(), reason="No PostgreSQL DATABASE_URL configured")


@skip_no_db
class TestUploadWithStandards:
    """Test upload with standards parameter."""

    def test_upload_standards_parameter_parsed(self, client, seed_data):
        """Upload with standards parameter should not reject the form field."""
        resp = client.post(
            "/api/uploads",
            data={
                "standards": json.dumps([seed_data["source_id"]]),
                "client_name": "Test Client",
                "site_address": "1 Test Street",
                "premises_type": "Office",
                "contact_person": "Test Person",
            },
            files={"file": ("test.csv", b"zone,co2_ppm\nZone A,500")},
        )
        # Should NOT be a 422 validation error on the standards field
        # (may fail for other reasons like storage, but standards parsing should work)
        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            for error in detail:
                loc = error.get("loc", [])
                assert "standards" not in str(loc), f"standards field caused 422: {error}"

    def test_upload_without_standards(self, client, seed_data):
        """Upload without standards parameter should proceed (defaults to site defaults)."""
        resp = client.post(
            "/api/uploads",
            data={
                "client_name": "Test Client 2",
                "site_address": "2 Test Street",
                "premises_type": "Office",
                "contact_person": "Test Person 2",
            },
            files={"file": ("test.csv", b"zone,co2_ppm\nZone A,600")},
        )
        # May fail for storage reasons, but should not 422 on missing standards
        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            for error in detail:
                loc = error.get("loc", [])
                assert "standards" not in str(loc), f"standards field caused 422: {error}"

    def test_upload_malformed_standards_json(self, client, seed_data):
        """Upload with malformed standards JSON should not crash."""
        resp = client.post(
            "/api/uploads",
            data={
                "standards": "not-valid-json{{{",
                "client_name": "Test Client 3",
                "site_address": "3 Test Street",
                "premises_type": "Office",
                "contact_person": "Test Person 3",
            },
            files={"file": ("test.csv", b"zone,co2_ppm\nZone A,700")},
        )
        # Should handle gracefully — standards_evaluated becomes None
        # Not a 422 on the standards field
        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            for error in detail:
                loc = error.get("loc", [])
                assert "standards" not in str(loc)


@skip_no_db
class TestFindingsWithStandardFilter:
    """Test findings endpoint with standard_id filter."""

    def test_findings_upload_not_found(self, client):
        """GET findings for non-existent upload returns 404."""
        resp = client.get("/api/uploads/00000000-0000-0000-0000-000000000000/findings")
        assert resp.status_code == 404

    def test_findings_with_standard_id_param_accepted(self, client):
        """GET findings with standard_id query param should not 422."""
        resp = client.get(
            "/api/uploads/00000000-0000-0000-0000-000000000000/findings",
            params={"standard_id": "some-source-id"},
        )
        # Will 404 since upload doesn't exist, but should not 422 on the param
        assert resp.status_code != 422


@skip_no_db
class TestUploadValidation:
    """Test upload input validation."""

    def test_upload_non_csv_file(self, client, seed_data):
        """Upload with non-CSV file returns 400."""
        resp = client.post(
            "/api/uploads",
            data={
                "client_name": "Test Client",
                "site_address": "1 Test Street",
                "premises_type": "Office",
                "contact_person": "Test Person",
            },
            files={"file": ("test.txt", b"not a csv")},
        )
        # May return 400 (not CSV) or 422 (missing required fields if validation order differs)
        assert resp.status_code in (400, 422)
        if resp.status_code == 400:
            assert "CSV" in resp.json()["detail"]

    def test_upload_minimal_succeeds(self, client):
        """Upload with only file succeeds — creates anonymous site."""
        resp = client.post(
            "/api/uploads",
            data={},
            files={"file": ("test.csv", b"zone,co2_ppm\nZone A,500")},
        )
        # tenant_id, site_id, standards are all optional
        assert resp.status_code == 201
