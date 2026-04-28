#!/usr/bin/env python3
"""
scripts/seed_default_tenant.py

Creates the "FJ Internal" default tenant and assigns all NULL-tenant sites to it.
Idempotent — safe to re-run.

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/seed_default_tenant.py
"""

import sys
from pathlib import Path

# Add backend to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from sqlmodel import Session, select, col
from app.database import engine
from app.models.supporting import Tenant
from app.models.workflow_b import Site

TENANT_NAME = "FJ Internal"


def seed_default_tenant(session: Session):
    """Create default tenant if missing, assign NULL-tenant sites."""

    # ── 1. Ensure default tenant exists ───────────────────────────────────────
    existing = session.exec(
        select(Tenant).where(col(Tenant.tenant_name) == TENANT_NAME)
    ).first()

    if existing:
        tenant = existing
        print(f"Tenant '{TENANT_NAME}' already exists (id={tenant.id})")
    else:
        tenant = Tenant(
            tenant_name=TENANT_NAME,
            contact_email="ops@fjsafespace.com",
        )
        session.add(tenant)
        session.flush()
        print(f"Created tenant '{TENANT_NAME}' (id={tenant.id})")

    # ── 2. Assign NULL-tenant sites ──────────────────────────────────────────
    null_sites = session.exec(
        select(Site).where(col(Site.tenant_id).is_(None))
    ).all()

    if null_sites:
        count = 0
        for site in null_sites:
            site.tenant_id = tenant.id
            count += 1
        print(f"Assigned {count} site(s) to tenant '{TENANT_NAME}'")
    else:
        print("No NULL-tenant sites to assign")

    return tenant.id, len(null_sites)


def main():
    print("=" * 60)
    print("Seeding default tenant")
    print("=" * 60)

    with Session(engine) as session:
        tenant_id, assigned = seed_default_tenant(session)
        session.commit()

    print(f"Done. Tenant: {tenant_id}, Sites assigned: {assigned}")
    print("=" * 60)


if __name__ == "__main__":
    main()
