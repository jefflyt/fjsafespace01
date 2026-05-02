"""
backend/tests/conftest.py

Shared pytest fixtures for backend tests.
Provides database connection, JWT helpers, and test data fixtures.
"""

import os
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load env from project root
ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"
if ENV_FILE.exists():
    import dotenv

    dotenv.load_dotenv(ENV_FILE)


# ── Database URL helper ──────────────────────────────────────────────────────


def _db_url():
    return os.environ.get("DATABASE_URL", "sqlite:///test.db")


def _has_db():
    """Check if real PostgreSQL is configured and accessible."""
    url = os.environ.get("DATABASE_URL", "")
    if not url or url.startswith("sqlite"):
        return False
    try:
        from sqlmodel import Session
        eng = create_engine(url)
        with Session(eng) as session:
            session.exec(text("SELECT 1")).first()
            eng.dispose()
            return True
    except Exception:
        return False


skip_no_db = pytest.mark.skipif(not _has_db(), reason="No PostgreSQL DATABASE_URL configured")


# ── Database session fixtures ────────────────────────────────────────────────


@pytest.fixture(scope="session")
def database_url():
    """Get DATABASE_URL from environment."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("DATABASE_URL not set")
    return url


@pytest.fixture(scope="session")
def engine(database_url):
    """Create SQLAlchemy engine for test database."""
    eng = create_engine(database_url)
    yield eng
    eng.dispose()


@pytest.fixture
def session(engine):
    """Create a database session for a single test."""
    Session = sessionmaker(bind=engine)
    sess = Session()
    try:
        yield sess
    finally:
        sess.close()


@pytest.fixture()
def client():
    """Create FastAPI TestClient with isolated DB session per test."""
    from fastapi.testclient import TestClient
    from sqlmodel import Session

    from app.api.dependencies import get_session
    from app.main import app

    eng = create_engine(_db_url())
    with Session(eng) as db_session:
        app.dependency_overrides[get_session] = lambda: db_session
        tc = TestClient(app)
        yield tc
        app.dependency_overrides.clear()
    eng.dispose()


# ── JWT Auth helpers ─────────────────────────────────────────────────────────


def make_test_jwt(user_id: str, secret: str = "test-secret-key-for-jwt-signing") -> str:
    """Create a valid test JWT for auth middleware tests."""
    import jwt
    import time

    payload = {
        "sub": user_id,
        "aud": "authenticated",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def jwt_secret():
    """Return the JWT secret used for signing test tokens."""
    return "test-secret-key-for-jwt-signing"


@pytest.fixture
def valid_jwt_token(jwt_secret):
    """Generate a valid JWT token for testing."""
    return make_test_jwt(user_id="test-user-001", secret=jwt_secret)


@pytest.fixture
def expired_jwt_token():
    """Generate an expired JWT token."""
    import jwt
    import time

    payload = {
        "sub": "test-user-001",
        "aud": "authenticated",
        "iat": int(time.time()) - 7200,
        "exp": int(time.time()) - 3600,
    }
    return jwt.encode(payload, "test-secret-key-for-jwt-signing", algorithm="HS256")


# ── Seed data fixtures ───────────────────────────────────────────────────────


@pytest.fixture
def seed_data(session):
    """Create test sites, tenants, reference sources, and user_tenant mappings."""
    tenant_id = str(uuid.uuid4())
    site_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    source_id = str(uuid.uuid4())

    # Create tenant
    session.execute(
        text(
            "INSERT INTO tenant (id, tenant_name, contact_email, created_at) "
            "VALUES (:id, :name, :email, NOW())"
        ),
        {"id": tenant_id, "name": "Test Tenant", "email": "test@example.com"},
    )

    # Create site
    session.execute(
        text(
            "INSERT INTO site (id, name, tenant_id, created_at) "
            "VALUES (:id, :name, :tenant_id, NOW())"
        ),
        {"id": site_id, "name": "Test Site", "tenant_id": tenant_id},
    )

    # Create user_tenant mapping
    session.execute(
        text(
            "INSERT INTO user_tenant (id, supabase_user_id, tenant_id, role, created_at) "
            "VALUES (:id, :user_id, :tenant_id, 'facility_manager', NOW())"
        ),
        {"id": str(uuid.uuid4()), "user_id": user_id, "tenant_id": tenant_id},
    )

    # Create reference source
    session.execute(
        text(
            "INSERT INTO reference_source (id, title, publisher, source_type, jurisdiction, status, "
            "source_currency_status, source_completeness_status, ingested_at) "
            "VALUES (:id, 'SS554', 'SPSG', 'standard', 'SG', 'active', "
            "'CURRENT_VERIFIED', 'complete', NOW())"
        ),
        {"id": source_id},
    )

    session.commit()

    data = {
        "tenant_id": tenant_id,
        "site_id": site_id,
        "user_id": user_id,
        "source_id": str(source_id),  # Ensure string type
    }
    yield data

    # Cleanup (order matters due to FK constraints)
    session.execute(text("DELETE FROM site_standards WHERE site_id = :sid"), {"sid": site_id})
    session.execute(text("DELETE FROM site_metric_preferences WHERE site_id = :sid"), {"sid": site_id})
    session.execute(text("DELETE FROM user_tenant WHERE supabase_user_id = :uid"), {"uid": user_id})
    session.execute(text("DELETE FROM site WHERE id = :sid"), {"sid": site_id})
    session.execute(text("DELETE FROM tenant WHERE id = :tid"), {"tid": tenant_id})
    session.execute(text("DELETE FROM reference_source WHERE id = :sid"), {"sid": source_id})
    session.commit()
