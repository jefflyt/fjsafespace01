"""
backend/tests/test_tenants_api.py

Integration tests for tenant management endpoints.
"""

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


class TestListTenants:
    def test_list_tenants_returns_all(self):
        """Returns all tenants with scan counts."""
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
                    "cn": "List Test Client",
                    "ce": f"list_{tenant_id[:8]}@test.com",
                },
            )
            db_session.commit()

            resp = tc.get("/api/tenants")
            assert resp.status_code == 200
            results = resp.json()
            assert isinstance(results, list)
            assert any(t["client_name"] == "List Test Client" for t in results)
        finally:
            app.dependency_overrides.clear()
            eng.dispose()


class TestGetTenant:
    def test_get_tenant_with_uploads(self):
        """Returns tenant details + upload history."""
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
                    "cn": "Detail Test",
                    "ce": f"detail_{tenant_id[:8]}@test.com",
                },
            )
            db_session.commit()

            resp = tc.get(f"/api/tenants/{tenant_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["client_name"] == "Detail Test"
            assert "uploads" in data
        finally:
            app.dependency_overrides.clear()
            eng.dispose()

    def test_get_tenant_not_found(self):
        """404 for non-existent tenant."""
        tc, db_session, eng = _make_client_session()
        try:
            resp = tc.get("/api/tenants/00000000-0000-0000-0000-000000000000")
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()
            eng.dispose()


class TestCreateTenant:
    def test_create_tenant_minimal(self):
        """POST with only client_name + contact_email."""
        tc, db_session, eng = _make_client_session()
        try:
            resp = tc.post(
                "/api/tenants",
                json={
                    "client_name": f"New Client {uuid.uuid4()}",
                    "contact_email": f"new_{uuid.uuid4()}@client.com",
                },
            )
            assert resp.status_code == 201
            data = resp.json()
            assert "client_name" in data
            assert "contact_email" in data
        finally:
            app.dependency_overrides.clear()
            eng.dispose()

    def test_create_tenant_unique_email(self):
        """Duplicate email → 409 Conflict."""
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
                    "cn": "Existing",
                    "ce": f"dup_{tenant_id[:8]}@test.com",
                },
            )
            db_session.commit()

            resp = tc.post(
                "/api/tenants",
                json={
                    "client_name": "Another",
                    "contact_email": f"dup_{tenant_id[:8]}@test.com",
                },
            )
            assert resp.status_code == 409
        finally:
            app.dependency_overrides.clear()
            eng.dispose()
