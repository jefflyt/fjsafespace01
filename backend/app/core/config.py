"""
backend/app/core/config.py

Application settings loaded from environment variables via pydantic-settings.
All variables are documented in backend/.env.example.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # ── Database ──────────────────────────────────────────────────────────────
    # App DB role: full read/write on Workflow B tables;
    # SELECT-only on Rulebook tables (enforced at DB permission level).
    DATABASE_URL: str

    # Full-privilege DB role for Workflow A admin console only.
    # Never imported by any dashboard router or service.
    ADMIN_DATABASE_URL: str

    # ── Governance ────────────────────────────────────────────────────────────
    # Jay Choy's email — enforced by QA-G8: only this identity may approve
    # certification-impact reports.
    APPROVER_EMAIL: str

    # ── Email ─────────────────────────────────────────────────────────────────
    RESEND_API_KEY: str

    # ── Phase 3 — Clerk auth (optional for Phase 1/2) ─────────────────────────
    CLERK_SECRET_KEY: str | None = None


settings = Settings()  # type: ignore[call-arg]
