#!/usr/bin/env python3
"""
scripts/cleanup_test_data.py

Removes all test data except NPE.

Keeps:
- NPE tenant (tenant_name='NPE')
- NPE sites (tenant_id linked to NPE)
- Uploads, readings, findings, batches tied to NPE sites

Deletes:
- All other tenants and their associated data
- Orphaned sites/uploads not tied to NPE
- All test upload batches not tied to NPE

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/cleanup_test_data.py [--dry-run]
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from sqlalchemy import text
from app.database import engine


def cleanup(dry_run: bool = False):
    npe_tenant_id = "ae8ee3d6-1c53-46a7-b87c-f21dcad2e138"
    # Also keep the npe_sample.csv site (tenant_id is NULL)
    npe_sample_site_id = "67ff80b0-b582-4303-b825-9ce41c995982"

    with engine.begin() as conn:
        # Get NPE site IDs (both NPE tenant sites + npe_sample.csv site)
        npe_sites = conn.execute(
            text("SELECT id::text FROM site WHERE tenant_id = :tid OR id = :nsid"),
            {"tid": npe_tenant_id, "nsid": npe_sample_site_id},
        ).all()
        npe_site_ids = [r[0] for r in npe_sites]
        print(f"NPE sites ({len(npe_site_ids)}): {[s[:8] for s in npe_site_ids]}")

        # Get NPE upload IDs (by site UUID cast)
        site_uuids = [s for s in npe_site_ids]
        if not site_uuids:
            site_uuids = ["00000000-0000-0000-0000-000000000000"]
        npe_uploads = conn.execute(
            text("SELECT id::text FROM upload WHERE site_id::text = ANY(:site_ids)"),
            {"site_ids": site_uuids},
        ).all()
        npe_upload_ids = [r[0] for r in npe_uploads]
        print(f"NPE uploads ({len(npe_upload_ids)}): {[u[:8] for u in npe_upload_ids]}")

        # Get NPE batch IDs
        npe_batches = conn.execute(
            text("SELECT id::text FROM upload_batch WHERE tenant_id::text = :tid"),
            {"tid": npe_tenant_id},
        ).all()
        npe_batch_ids = [r[0] for r in npe_batches]
        print(f"NPE batches ({len(npe_batches)}): {[b[:8] for b in npe_batch_ids]}")

        # Counts to delete
        stats = {}

        if npe_upload_ids:
            upload_placeholders = ",".join([f"'{u}'" for u in npe_upload_ids])
        else:
            upload_placeholders = "'00000000-0000-0000-0000-000000000000'"

        if site_uuids:
            site_placeholders = ",".join([f"'{s}'" for s in site_uuids])
        else:
            site_placeholders = "'00000000-0000-0000-0000-000000000000'"

        # 1. Findings not tied to NPE uploads
        stats["findings"] = conn.execute(
            text(f"SELECT COUNT(*) FROM finding WHERE upload_id::text NOT IN ({upload_placeholders})"),
        ).scalar()

        # 2. Readings not tied to NPE uploads
        stats["readings"] = conn.execute(
            text(f"SELECT COUNT(*) FROM reading WHERE upload_id::text NOT IN ({upload_placeholders})"),
        ).scalar()

        # 3. Reports not tied to NPE uploads
        stats["reports"] = conn.execute(
            text(f"SELECT COUNT(*) FROM report WHERE upload_id::text NOT IN ({upload_placeholders})"),
        ).scalar()

        # 4. Uploads not tied to NPE sites
        stats["uploads"] = conn.execute(
            text(f"SELECT COUNT(*) FROM upload WHERE site_id::text NOT IN ({site_placeholders})"),
        ).scalar()

        # 5. Upload batches not tied to NPE
        stats["batches"] = conn.execute(
            text("SELECT COUNT(*) FROM upload_batch WHERE tenant_id::text != :tid OR tenant_id IS NULL"),
            {"tid": npe_tenant_id},
        ).scalar()

        # 6. Site metric preferences not for NPE sites
        stats["metric_prefs"] = conn.execute(
            text(f"SELECT COUNT(*) FROM site_metric_preferences WHERE site_id::text NOT IN ({site_placeholders})"),
        ).scalar()

        # 7. Site standards not for NPE sites
        stats["site_standards"] = conn.execute(
            text(f"SELECT COUNT(*) FROM site_standards WHERE site_id::text NOT IN ({site_placeholders})"),
        ).scalar()

        # 8. User-tenant mappings not for NPE
        stats["user_tenants"] = conn.execute(
            text("SELECT COUNT(*) FROM user_tenant WHERE tenant_id::text != :tid"),
            {"tid": npe_tenant_id},
        ).scalar()

        # 9. Sites not tied to NPE (or npe_sample.csv)
        stats["sites"] = conn.execute(
            text("SELECT COUNT(*) FROM site WHERE (tenant_id::text != :tid OR tenant_id IS NULL) AND id::text != :nsid"),
            {"tid": npe_tenant_id, "nsid": npe_sample_site_id},
        ).scalar()

        # 10. Tenants other than NPE
        stats["tenants"] = conn.execute(
            text("SELECT COUNT(*) FROM tenant WHERE id::text != :tid"),
            {"tid": npe_tenant_id},
        ).scalar()

        # 11. Notifications for non-NPE tenants
        stats["notifications"] = conn.execute(
            text("SELECT COUNT(*) FROM notification WHERE (tenant_id::text != :tid OR tenant_id IS NULL)"),
            {"tid": npe_tenant_id},
        ).scalar()

        print(f"\nRecords to DELETE:")
        for k, v in stats.items():
            print(f"  {k}: {v}")

        if dry_run:
            print("\n[DRY RUN] No changes made. Remove --dry-run to apply.")
            return

        # Execute deletes in dependency order (child first)
        conn.execute(
            text(f"DELETE FROM finding WHERE upload_id::text NOT IN ({upload_placeholders})"),
        )
        conn.execute(
            text(f"DELETE FROM reading WHERE upload_id::text NOT IN ({upload_placeholders})"),
        )
        conn.execute(
            text(f"DELETE FROM report WHERE upload_id::text NOT IN ({upload_placeholders})"),
        )
        # Clear batch_id on uploads referencing non-NPE batches before deleting batches
        npe_batch_placeholders = ",".join([f"'{b}'" for b in npe_batch_ids]) if npe_batch_ids else "'00000000-0000-0000-0000-000000000000'"
        conn.execute(
            text(f"UPDATE upload SET batch_id = NULL WHERE batch_id::text NOT IN ({npe_batch_placeholders})"),
        )
        conn.execute(
            text("DELETE FROM upload_batch WHERE tenant_id::text != :tid OR tenant_id IS NULL"),
            {"tid": npe_tenant_id},
        )
        conn.execute(
            text(f"DELETE FROM upload WHERE site_id::text NOT IN ({site_placeholders})"),
        )
        conn.execute(
            text(f"DELETE FROM site_metric_preferences WHERE site_id::text NOT IN ({site_placeholders})"),
        )
        conn.execute(
            text(f"DELETE FROM site_standards WHERE site_id::text NOT IN ({site_placeholders})"),
        )
        conn.execute(
            text("DELETE FROM user_tenant WHERE tenant_id::text != :tid"),
            {"tid": npe_tenant_id},
        )
        conn.execute(
            text("DELETE FROM notification WHERE (tenant_id::text != :tid OR tenant_id IS NULL)"),
            {"tid": npe_tenant_id},
        )
        conn.execute(
            text("DELETE FROM site WHERE (tenant_id::text != :tid OR tenant_id IS NULL) AND id::text != :nsid"),
            {"tid": npe_tenant_id, "nsid": npe_sample_site_id},
        )
        conn.execute(
            text("DELETE FROM tenant WHERE id::text != :tid"),
            {"tid": npe_tenant_id},
        )

        print("\nCleanup complete!")


if __name__ == "__main__":
    cleanup(dry_run="--dry-run" in sys.argv)
