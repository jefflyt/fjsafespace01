"""
backend/app/database.py

SQLAlchemy engine and session factory.
Import `get_session` as a FastAPI dependency via app/api/dependencies.py.
"""

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

# connect_args={"check_same_thread": False} is only needed for SQLite.
# For PostgreSQL, pool_pre_ping ensures stale connections are recycled.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False,  # set True temporarily for query debugging
)


def create_db_and_tables() -> None:
    """Create all tables if they don't exist. Used for local dev / testing only.
    In production, Alembic manages schema migrations."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Yields a SQLModel Session.  Use as a FastAPI dependency."""
    with Session(engine) as session:
        yield session
