"""
backend/tests/conftest.py

Shared pytest fixtures for integration tests.

Provides:
- db_engine: SQLAlchemy engine pointing to test database
- db_session: SQLModel session (tests are responsible for cleanup via rollback)
- client: FastAPI test client with dependency overrides for DB session

Uses a simple approach: each test gets a fresh session, and data is
rolled back after each test. Tests that need a clean slate should
run in isolation or truncate tables manually.

Usage:
    pytest tests/integration/ -v

Requires a running PostgreSQL database on DATABASE_URL from .env.
"""

import os
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

# Ensure backend is on the path so app modules resolve
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import get_session  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402

# Import all models so SQLModel metadata is complete
import app.models.workflow_a  # noqa: E402, F401
import app.models.workflow_b  # noqa: E402, F401
import app.models.supporting  # noqa: E402, F401


# ── Database fixtures ─────────────────────────────────────────────────────────

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", os.environ.get("DATABASE_URL"))


@pytest.fixture(scope="session")
def db_engine():
    """Create a test database engine. Uses DATABASE_URL from environment."""
    if not TEST_DATABASE_URL:
        pytest.skip("DATABASE_URL not set — skipping integration tests")

    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    # Create all tables (idempotent — migrations should have run first)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture()
def db_session(db_engine) -> Generator[Session, None, None]:
    """
    Yield a session. After the test, rollback to undo any changes.
    Note: Data committed by the session will be rolled back.
    For tests that need complete isolation, use unique prefixes or truncate.
    """
    with Session(db_engine) as session:
        yield session
        session.rollback()


# ── FastAPI client fixture ────────────────────────────────────────────────────

@pytest.fixture()
def client(db_session):
    """
    FastAPI test client with DB dependency overridden to use test session.
    """
    def override_get_session():
        yield db_session

    fastapi_app.dependency_overrides[get_session] = override_get_session

    with TestClient(fastapi_app) as test_client:
        yield test_client

    fastapi_app.dependency_overrides.clear()
