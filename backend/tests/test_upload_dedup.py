"""
backend/tests/test_upload_dedup.py

Tests for CSV upload deduplication via content hash.
"""

import io
import os
import uuid

import pytest

from app.main import app
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, select
from app.models.supporting import Tenant
from app.models.workflow_b import Site, Upload, Reading, Finding


def _has_pg():
    url = os.environ.get("DATABASE_URL", "")
    return url.startswith("postgresql")


skip_no_db = pytest.mark.skipif(not _has_pg(), reason="No PostgreSQL")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    from app.core.config import settings
    engine = create_engine(settings.DATABASE_URL)
    with Session(engine) as session:
        yield session
        session.rollback()


@pytest.fixture
def seed_data(db_session):
    """Create a tenant + site for testing."""
    tenant = Tenant(
        id=str(uuid.uuid4()),
        tenant_name="Dedup Test Corp",
        client_name="Dedup Test Corp",
        contact_email=f"dedup-{uuid.uuid4().hex[:8]}@test.com",
    )
    db_session.add(tenant)
    db_session.flush()

    site = Site(
        id=str(uuid.uuid4()),
        name="Dedup Test Site",
        tenant_id=tenant.id,
    )
    db_session.add(site)
    db_session.commit()

    return {"tenant_id": tenant.id, "site_id": site.id}


SIMPLE_CSV = (
    b"Timestamp,Device ID,Zone,CO2 (ppm),PM2.5 (ug/m3),TVOC (ppb),"
    b"Temperature (C),Humidity (%)\n"
    b"2026-01-01 00:00:00,DEV1,Zone A,450,12,100,22,50\n"
)


def _cleanup_tenant(tenant_id):
    """Delete all DB records for a test tenant."""
    from app.core.config import settings
    engine = create_engine(settings.DATABASE_URL)
    with Session(engine) as session:
        site_ids = session.exec(
            select(Site.id).where(Site.tenant_id == tenant_id)
        ).all()
        for sid in site_ids:
            for item in session.exec(select(Finding).where(Finding.site_id == sid)):
                session.delete(item)
            for item in session.exec(select(Reading).where(Reading.site_id == sid)):
                session.delete(item)
            for item in session.exec(select(Upload).where(Upload.site_id == sid)):
                session.delete(item)
            site = session.get(Site, sid)
            if site:
                session.delete(site)
        tenant = session.get(Tenant, tenant_id)
        if tenant:
            session.delete(tenant)
        session.commit()


@skip_no_db
class TestUploadDeduplication:

    def test_same_csv_same_tenant_returns_duplicate(self, client, seed_data):
        """First upload succeeds (201). Same CSV by same tenant returns 201 with is_duplicate=True."""
        resp1 = client.post(
            "/api/uploads",
            data={"tenant_id": str(seed_data["tenant_id"]), "site_id": str(seed_data["site_id"])},
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp1.status_code == 201
        assert resp1.json()["is_duplicate"] is False
        first_id = resp1.json()["upload_id"]

        # Same tenant, different (auto-created) site
        resp2 = client.post(
            "/api/uploads",
            data={"tenant_id": str(seed_data["tenant_id"])},
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp2.status_code == 201
        data = resp2.json()
        assert data["is_duplicate"] is True
        assert data["duplicate_of"] == first_id
        assert data["upload_id"] == first_id

        _cleanup_tenant(seed_data["tenant_id"])

    def test_force_bypass_dedup(self, client, seed_data):
        """force=true creates new upload even for duplicate content."""
        resp1 = client.post(
            "/api/uploads",
            data={"tenant_id": str(seed_data["tenant_id"]), "site_id": str(seed_data["site_id"])},
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp1.status_code == 201

        resp2 = client.post(
            "/api/uploads",
            data={
                "tenant_id": str(seed_data["tenant_id"]),
                "site_id": str(seed_data["site_id"]),
                "force": "true",
            },
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp2.status_code == 201
        assert resp2.json()["is_duplicate"] is False
        assert resp2.json()["upload_id"] != resp1.json()["upload_id"]

        _cleanup_tenant(seed_data["tenant_id"])

    def test_same_csv_different_tenant_not_duplicate(self, client, db_session):
        """Same CSV by different tenant → NOT a duplicate."""
        t1 = Tenant(
            id=str(uuid.uuid4()),
            tenant_name="T1",
            client_name="T1",
            contact_email=f"t1-{uuid.uuid4().hex[:8]}@x.com",
        )
        t2 = Tenant(
            id=str(uuid.uuid4()),
            tenant_name="T2",
            client_name="T2",
            contact_email=f"t2-{uuid.uuid4().hex[:8]}@x.com",
        )
        db_session.add_all([t1, t2])
        db_session.flush()

        s1 = Site(id=str(uuid.uuid4()), name="S1", tenant_id=t1.id)
        db_session.add(s1)
        db_session.commit()

        resp1 = client.post(
            "/api/uploads",
            data={"tenant_id": str(t1.id), "site_id": str(s1.id)},
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp1.status_code == 201

        resp2 = client.post(
            "/api/uploads",
            data={"tenant_id": str(t2.id)},
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp2.status_code == 201
        assert resp2.json()["is_duplicate"] is False

        _cleanup_tenant(t1.id)
        _cleanup_tenant(t2.id)

    def test_different_csv_same_tenant_not_duplicate(self, client, seed_data):
        """Different CSV content → NOT a duplicate."""
        csv_a = (
            b"Timestamp,Device ID,Zone,CO2 (ppm),PM2.5 (ug/m3),TVOC (ppb),"
            b"Temperature (C),Humidity (%)\n"
            b"2026-01-01 00:00:00,DEV1,Zone A,450,12,100,22,50\n"
        )
        csv_b = (
            b"Timestamp,Device ID,Zone,CO2 (ppm),PM2.5 (ug/m3),TVOC (ppb),"
            b"Temperature (C),Humidity (%)\n"
            b"2026-01-01 00:00:00,DEV1,Zone A,999,12,100,22,50\n"
        )

        resp1 = client.post(
            "/api/uploads",
            data={"tenant_id": str(seed_data["tenant_id"]), "site_id": str(seed_data["site_id"])},
            files={"file": ("test.csv", io.BytesIO(csv_a))},
        )
        assert resp1.status_code == 201

        resp2 = client.post(
            "/api/uploads",
            data={"tenant_id": str(seed_data["tenant_id"])},
            files={"file": ("test.csv", io.BytesIO(csv_b))},
        )
        assert resp2.status_code == 201
        assert resp2.json()["is_duplicate"] is False

        _cleanup_tenant(seed_data["tenant_id"])

    def test_no_tenant_no_dedup(self, client, seed_data):
        """Upload without tenant_id (anonymous) → never flagged as duplicate."""
        # First anonymous upload
        resp1 = client.post(
            "/api/uploads",
            data={},
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp1.status_code == 201

        # Second anonymous upload of same content — no tenant, no dedup
        resp2 = client.post(
            "/api/uploads",
            data={},
            files={"file": ("test.csv", io.BytesIO(SIMPLE_CSV))},
        )
        assert resp2.status_code == 201
        assert resp2.json()["is_duplicate"] is False
