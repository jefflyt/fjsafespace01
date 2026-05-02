"""
backend/tests/test_upload_tenant_flow.py

Integration tests for the adhoc customer intake upload flow.
Tests tenant lookup, creation, dedup, and upload linking.
"""

import io
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy import create_engine
from sqlmodel import Session

from .conftest import _db_url, skip_no_db
from app.api.dependencies import get_session
from app.main import app


@skip_no_db
def _make_client_session():
    """Create a TestClient with dependency override using shared engine."""
    eng = create_engine(_db_url())
    db_session = Session(eng)
    app.dependency_overrides[get_session] = lambda: db_session
    tc = TestClient(app)
    return tc, db_session, eng


class TestSearchTenants:
    def test_search_tenants_by_client_name(self):
        """Search finds matching tenants by client name."""
        tc, db_session, eng = _make_client_session()
        try:
            tenant_id = str(uuid.uuid4())
            db_session.execute(
                text(
                    "INSERT INTO tenant (id, tenant_name, client_name, contact_email, site_address, contact_person, created_at) "
                    "VALUES (:id, :tn, :cn, :ce, :sa, :cp, NOW())"
                ),
                {
                    "id": tenant_id,
                    "tn": "Test Corp",
                    "cn": "Acme Corporation",
                    "ce": f"acme_{tenant_id[:8]}@test.com",
                    "sa": "123 Main St",
                    "cp": "John Doe",
                },
            )
            db_session.commit()

            resp = tc.get("/api/tenants/search", params={"q": "Acme"})
            assert resp.status_code == 200
            results = resp.json()
            assert len(results) >= 1
            assert results[0]["client_name"] == "Acme Corporation"
        finally:
            app.dependency_overrides.clear()
            eng.dispose()

    def test_search_tenants_by_contact_person(self):
        """Search by contact person works."""
        tc, db_session, eng = _make_client_session()
        try:
            tenant_id = str(uuid.uuid4())
            db_session.execute(
                text(
                    "INSERT INTO tenant (id, tenant_name, client_name, contact_email, contact_person, created_at) "
                    "VALUES (:id, :tn, :cn, :ce, :cp, NOW())"
                ),
                {
                    "id": tenant_id,
                    "tn": "Test Corp",
                    "cn": "Acme Corporation",
                    "ce": f"acme2_{tenant_id[:8]}@test.com",
                    "cp": "Jane Smith",
                },
            )
            db_session.commit()

            resp = tc.get("/api/tenants/search", params={"q": "Jane"})
            assert resp.status_code == 200
            results = resp.json()
            assert any(r["contact_person"] == "Jane Smith" for r in results)
        finally:
            app.dependency_overrides.clear()
            eng.dispose()

    def test_search_returns_empty_for_short_query(self):
        """Query shorter than 2 chars returns empty."""
        tc, db_session, eng = _make_client_session()
        try:
            resp = tc.get("/api/tenants/search", params={"q": "a"})
            assert resp.status_code == 200
            assert resp.json() == []
        finally:
            app.dependency_overrides.clear()
            eng.dispose()


class TestUploadWithTenant:
    def test_upload_with_existing_tenant(self):
        """Upload with tenant_id links to existing tenant."""
        tc, db_session, eng = _make_client_session()
        try:
            tenant_id = str(uuid.uuid4())
            db_session.execute(
                text(
                    "INSERT INTO tenant (id, tenant_name, client_name, contact_email, created_at) "
                    "VALUES (:id, :tn, :cn, :ce, NOW())"
                ),
                {
                    "id": tenant_id,
                    "tn": "Test Corp",
                    "cn": "Test Client",
                    "ce": f"testclient_{tenant_id[:8]}@test.com",
                },
            )
            db_session.commit()

            csv_content = (
                "Timestamp,Device ID,Zone,CO2 (ppm),PM2.5 (ug/m3),TVOC (ppb),Temperature (C),Humidity (%)\n"
                "2024-01-01 00:00:00,dev1,Zone1,450,12,100,22,50"
            )

            resp = tc.post(
                "/api/uploads",
                files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
                data={"tenant_id": tenant_id},
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["tenant_id"] == tenant_id
        finally:
            app.dependency_overrides.clear()
            eng.dispose()

    def test_upload_dedupe_by_email(self):
        """Same contact_email → same tenant reused (409 on duplicate create)."""
        tc, db_session, eng = _make_client_session()
        try:
            tenant_id = str(uuid.uuid4())
            db_session.execute(
                text(
                    "INSERT INTO tenant (id, tenant_name, client_name, contact_email, created_at) "
                    "VALUES (:id, :tn, :cn, :ce, NOW())"
                ),
                {
                    "id": tenant_id,
                    "tn": "Test Corp",
                    "cn": "Existing Client",
                    "ce": f"unique_{tenant_id[:8]}@test.com",
                },
            )
            db_session.commit()

            # Try to create tenant with same email
            resp = tc.post(
                "/api/tenants",
                json={
                    "client_name": "Another Client",
                    "contact_email": f"unique_{tenant_id[:8]}@test.com",
                },
            )
            assert resp.status_code == 409
        finally:
            app.dependency_overrides.clear()
            eng.dispose()


class TestPatchTenant:
    def test_patch_tenant_updates_info(self):
        """PATCH updates customer fields."""
        tc, db_session, eng = _make_client_session()
        try:
            tenant_id = str(uuid.uuid4())
            db_session.execute(
                text(
                    "INSERT INTO tenant (id, tenant_name, client_name, contact_email, created_at) "
                    "VALUES (:id, :tn, :cn, :ce, NOW())"
                ),
                {
                    "id": tenant_id,
                    "tn": "Test Corp",
                    "cn": "Original Name",
                    "ce": f"patch_{tenant_id[:8]}@test.com",
                },
            )
            db_session.commit()

            resp = tc.patch(
                f"/api/tenants/{tenant_id}",
                json={"client_name": "Updated Name"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["client_name"] == "Updated Name"
        finally:
            app.dependency_overrides.clear()
            eng.dispose()
