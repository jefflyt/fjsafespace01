"""
backend/tests/integration/test_upload_pipeline.py

Integration tests for the full Workflow B upload pipeline.

These tests require a running database (use docker compose up -d before running).

Key scenarios from TDD §8.2:
- Full upload pipeline: POST /api/uploads → parse → findings → DB written correctly
- Rulebook read-only: PUT/POST/DELETE /api/rulebook/* returns 405
- Report QA gate block: POST /api/reports/generate returns 422 when a gate is violated
- WeasyPrint integration: render test HTML → valid PDF bytes
- PDF storage: PDF bytes correctly saved to Report.pdfBinaryData

From TDD §8.4 (E2E):
- NPE dry-run: NPE sample CSV → dashboard renders → Executive view shows top risks
- Cross-site comparison: 2 sites → comparison table ranks by wellness index correctly
"""

import pytest


@pytest.fixture
def client():
    """
    ASGI test client for FastAPI app.
    TODO: configure test DB and create tables before yielding client.
    """
    pytest.skip("Integration test infrastructure not yet set up")


def test_full_upload_pipeline(client):
    """
    POST /api/uploads with valid CSV → parse → findings → DB records created.
    Assert: parseStatus=COMPLETE, findingCount > 0, all findings have ruleVersion + citationUnitIds.
    """
    pytest.skip("Not yet implemented")


def test_rulebook_mutations_return_405(client):
    """
    PUT / POST / DELETE on any /api/rulebook/* route must return 405.
    Enforces Differentiation Requirement D3: no threshold override.
    """
    pytest.skip("Not yet implemented")


def test_report_generation_blocked_by_qa_gate(client):
    """
    POST /api/reports/generate with a finding missing citationUnitIds → 422 with gate=QA-G5.
    """
    pytest.skip("Not yet implemented")


def test_weasyprint_renders_valid_pdf():
    """
    Pass a minimal HTML string to WeasyPrint → output is non-empty bytes starting with %PDF.
    """
    pytest.skip("Not yet implemented")


def test_pdf_bytes_stored_in_report_record(client):
    """
    After successful report generation, GET /api/reports/{id} → pdfBinaryData is not null.
    GET /api/reports/{id}/export → Content-Type: application/pdf.
    """
    pytest.skip("Not yet implemented")


def test_cross_site_comparison_sorted_by_wellness_index(client):
    """
    After uploading data for 2 sites, GET /api/dashboard/comparison returns sites
    sorted by wellnessIndexScore DESC.
    """
    pytest.skip("Not yet implemented")
