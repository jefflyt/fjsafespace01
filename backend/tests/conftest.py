"""
backend/tests/conftest.py

Shared pytest fixtures for backend tests.
Provides database connection and model fixtures.
"""

import os
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load env from project root
ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"
if ENV_FILE.exists():
    import dotenv
    dotenv.load_dotenv(ENV_FILE)


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
