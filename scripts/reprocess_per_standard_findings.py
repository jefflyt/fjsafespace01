#!/usr/bin/env python3
"""
scripts/reprocess_per_standard_findings.py

Reprocesses all uploads that have readings, generating per-standard findings.

For each upload:
1. Delete existing findings
2. Fetch all active standards (CURRENT_VERIFIED reference sources)
3. For each standard, evaluate ALL readings against that standard's rules
4. Create findings with correct reference_source_id per standard

This fixes the flawed backfill that assigned each metric to only ONE standard,
when metrics like CO2 and PM25 are defined by MULTIPLE standards.

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/reprocess_per_standard_findings.py [--dry-run]
"""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from sqlmodel import Session, select, col
from sqlalchemy import text
from app.database import engine
from app.models.workflow_a import ReferenceSource, RulebookEntry
from app.models.workflow_b import Finding, Upload, Reading
from app.services.db_rule_service import fetch_rules_by_standard
from app.skills.iaq_rule_governor.rule_engine import evaluate_readings
from app.skills.iaq_rule_governor.wellness_index import (
    calculate_wellness_index,
    derive_certification_outcome,
)

_DEFAULT_RULE_VERSION = "v2-refactor"


def reprocess_upload(session: Session, upload: Upload, dry_run: bool = False):
    """Reprocess a single upload with per-standard evaluation."""
    upload_id = str(upload.id)

    # Get readings for this upload
    readings = session.exec(
        select(Reading).where(col(Reading.upload_id) == upload_id)
    ).all()

    if not readings:
        print(f"  Upload {upload_id[:8]}.. has no readings, skipping")
        return

    # Convert readings to normalised row format
    rows_to_persist = []
    for r in readings:
        rows_to_persist.append({
            "zone_name": r.zone_name,
            "metric_name": r.metric_name.value if hasattr(r.metric_name, "value") else str(r.metric_name),
            "metric_value": r.metric_value,
            "metric_unit": r.metric_unit,
            "site_id": str(r.site_id),
            "upload_id": upload_id,
            "is_outlier": r.is_outlier,
        })

    print(f"  Upload {upload_id[:8]}.. file={upload.file_name} readings={len(rows_to_persist)}")

    if dry_run:
        print(f"    [DRY RUN] Would delete existing findings and re-evaluate against all standards")
        return

    # Delete existing findings for this upload
    session.execute(
        text("DELETE FROM finding WHERE upload_id = :uid"),
        {"uid": upload_id},
    )

    # Fetch active standards
    active_sources = session.exec(
        select(ReferenceSource).where(
            col(ReferenceSource.source_currency_status) == "CURRENT_VERIFIED",
            col(ReferenceSource.status) == "active",
        )
    ).all()

    eval_findings = []
    standards_evaluated = []

    for source in active_sources:
        source_id = str(source.id)
        std_rules = fetch_rules_by_standard(session, source_id, _DEFAULT_RULE_VERSION)
        if not std_rules:
            continue

        std_findings = evaluate_readings(
            rows_to_persist,
            site_id=str(upload.site_id),
            upload_id=upload_id,
            rule_version=_DEFAULT_RULE_VERSION,
            rules=std_rules,
        )
        eval_findings.extend(std_findings)
        standards_evaluated.append(source_id)
        print(f"    Standard {source.title[:30]}.. → {len(std_findings)} findings")

    # Persist findings
    for ef in eval_findings:
        finding = Finding(
            upload_id=upload_id,
            site_id=str(upload.site_id),
            zone_name=ef.zone_name,
            metric_name=ef.metric_name,
            metric_value=ef.metric_value,
            threshold_band=ef.threshold_band,
            interpretation_text=ef.interpretation_text,
            workforce_impact_text=ef.workforce_impact_text,
            recommended_action=ef.recommended_action,
            rule_id=ef.rule_id,
            rule_version=ef.rule_version,
            citation_unit_ids=json.dumps(ef.citation_unit_ids),
            confidence_level=ef.confidence_level,
            source_currency_status=ef.source_currency_status,
            benchmark_lane=ef.benchmark_lane,
            reference_source_id=ef.reference_source_id,
        )
        session.add(finding)

    # Update upload record
    upload.rule_version_used = _DEFAULT_RULE_VERSION
    upload.standards_evaluated = standards_evaluated

    session.commit()
    print(f"    Committed {len(eval_findings)} total findings across {len(standards_evaluated)} standards")


def main():
    dry_run = "--dry-run" in sys.argv

    with Session(engine) as session:
        # Get all uploads that have readings
        result = session.execute(text('''
            SELECT DISTINCT u.id, u.file_name, u.site_id, u.uploaded_at
            FROM upload u
            JOIN reading r ON r.upload_id = u.id
            ORDER BY u.uploaded_at DESC
        '''))

        uploads_data = result.fetchall()
        print(f"Found {len(uploads_data)} uploads with readings\n")

        for row in uploads_data:
            upload = session.get(Upload, row[0])
            if upload:
                reprocess_upload(session, upload, dry_run)

        if dry_run:
            print("\n[DRY RUN] No changes made. Remove --dry-run to apply.")


if __name__ == "__main__":
    main()
