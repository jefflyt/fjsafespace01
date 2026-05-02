"""
backend/app/api/routers/uploads.py

Upload routes — Workflow B entry point.

POST /api/uploads
    Accepts a CSV file + siteId.  Synchronously: parse → validate →
    normalise → rule evaluate → write findings to DB.
    Returns upload summary with findingCount and any warnings.

GET /api/uploads/{upload_id}
    Returns upload metadata and parse status.

GET /api/uploads/{upload_id}/findings
    Returns all findings for an upload.
    Returns 422 if any finding is missing rule_version or citation_unit_ids
    (enforces QA-G5 / Differentiation Requirement D1).

Reference: TDD §4.1
"""

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, UploadFile, status, Form
from sqlmodel import Session, col, select, text

from app.api.dependencies import SessionDep, TenantIdDep
from app.models.enums import ParseOutcome, ParseStatus
from app.models.supporting import Tenant
from app.models.workflow_b import Finding, Reading, Upload
from app.skills.data_ingestion.csv_parser import parse_csv
from app.skills.data_ingestion.supabase_storage import SupabaseStorage, SupabaseStorageError
from app.skills.iaq_rule_governor.rule_engine import evaluate_readings
from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index, derive_certification_outcome
from app.services.db_rule_service import fetch_rules_from_db

router = APIRouter()

# R1: Default rule version — matches seed_rulebook_v1.py
_DEFAULT_RULE_VERSION = "v2-refactor"

# Weights sourced from rulebook_entry index_weight_percent for v2-refactor.
_DEFAULT_RULEBOOK_WEIGHTS: dict[str, float] = {
    "co2_ppm": 25.0,
    "pm25_ugm3": 20.0,
    "tvoc_ppb": 15.0,
    "temperature_c": 10.0,
    "humidity_rh": 10.0,
}


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def create_upload(
    session: SessionDep,
    jwt_tenant_id: TenantIdDep,
    file: UploadFile,
    tenant_id: str | None = Form(default=None),
    site_id: str | None = Form(default=None),
    standards: str | None = Form(default=None),
):
    """
    Accept a CSV export from uHoo, parse, validate, evaluate against the
    active Rulebook version, store findings, and return the upload summary.

    R1-07: Accepts optional tenant_id to link upload to a customer tenant.
    When tenant_id is provided, a site is created linked to that tenant.
    Authenticated uploads (jwt_tenant_id) are linked to the user's tenant.
    """
    # Validate content type
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    # Determine tenant to link the upload to
    _tenant_id = tenant_id or jwt_tenant_id

    # Determine or create site
    if site_id:
        # Verify site exists
        existing_site = session.exec(
            text("SELECT id, tenant_id FROM site WHERE id = :id"),
            {"id": site_id},
        ).first()
        if not existing_site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Site {site_id} not found",
            )
        _site_id = site_id
    elif _tenant_id:
        # Create a site linked to the customer's tenant
        _site_id = str(uuid.uuid4())
        t = session.get(Tenant, _tenant_id)
        site_name = (
            f"{t.client_name} — {t.site_address}"
            if t and t.site_address
            else (t.client_name if t else file.filename)
        )
        session.execute(
            text(
                "INSERT INTO site (id, name, tenant_id, created_at) "
                "VALUES (:id, :name, :tenant_id, NOW())"
            ),
            {
                "id": _site_id,
                "name": site_name,
                "tenant_id": _tenant_id,
            },
        )
    else:
        # No tenant, no site_id — create anonymous site (backward compatible)
        _site_id = str(uuid.uuid4())
        session.execute(
            text(
                "INSERT INTO site (id, name, tenant_id, created_at) "
                "VALUES (:id, :name, NULL, NOW())"
            ),
            {
                "id": _site_id,
                "name": file.filename,
            },
        )

    # Parse optional standards parameter (JSON array of source IDs)
    standards_evaluated = None
    if standards:
        try:
            standards_evaluated = json.loads(standards)
        except (json.JSONDecodeError, TypeError):
            standards_evaluated = None

    # Create upload record with PENDING status
    upload_id = str(uuid.uuid4())
    upload = Upload(
        id=upload_id,
        site_id=_site_id,
        file_name=file.filename,
        uploaded_by="anonymous",  # R1: no auth yet; Phase 3: extract from JWT
        uploaded_at=datetime.utcnow(),
        parse_status=ParseStatus.PENDING,
        standards_evaluated=standards_evaluated,
    )
    session.add(upload)
    session.commit()
    session.refresh(upload)

    # Read file bytes
    import re

    file_bytes = await file.read()

    # Sanitize filename for Supabase Storage (S3 doesn't allow brackets, etc.)
    safe_filename = re.sub(r'[\[\]{}^%`~#|\\]', '_', file.filename or "upload.csv")

    # Upload to Supabase Storage
    try:
        storage = SupabaseStorage()
        storage_path = f"uploads/{upload_id}/{safe_filename}"
        _ = storage.upload_file(file_bytes, storage_path)
    except SupabaseStorageError as e:
        upload.parse_status = ParseStatus.FAILED
        upload.parse_outcome = ParseOutcome.FAIL
        upload.warnings = f"Storage upload failed: {str(e)}"
        session.add(upload)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store file: {str(e)}",
        )

    # Update status to PROCESSING
    upload.parse_status = ParseStatus.PROCESSING
    session.add(upload)
    session.commit()

    # Parse CSV
    try:
        from io import BytesIO

        parse_result = parse_csv(
            BytesIO(file_bytes),
            site_id=_site_id,
            upload_id=upload_id,
        )
    except Exception as e:
        upload.parse_status = ParseStatus.FAILED
        upload.parse_outcome = ParseOutcome.FAIL
        upload.warnings = f"CSV parsing failed: {str(e)}"
        session.add(upload)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CSV parsing failed: {str(e)}",
        )

    # Update upload with parse results
    upload.parse_status = ParseStatus.COMPLETE
    upload.parse_outcome = parse_result.parse_outcome
    upload.warnings = ", ".join(parse_result.warnings) if parse_result.warnings else None
    upload.report_type = parse_result.report_type

    # Persist readings to DB (one row per metric per CSV row)
    for row in parse_result.normalised_rows:
        reading = Reading(
            upload_id=upload_id,
            site_id=_site_id,
            device_id=row["device_id"],
            zone_name=row["zone_name"],
            reading_timestamp=row["reading_timestamp"],
            metric_name=row["metric_name"],
            metric_value=row["metric_value"],
            metric_unit=row["metric_unit"],
            is_outlier=row.get("is_outlier", False),
        )
        session.add(reading)
    session.commit()

    # Evaluate readings against rulebook to generate findings
    # Fetch rules from DB; fall back to hardcoded rules if DB is empty
    db_rules = fetch_rules_from_db(session, _DEFAULT_RULE_VERSION)
    eval_findings = evaluate_readings(
        parse_result.normalised_rows,
        site_id=_site_id,
        upload_id=upload_id,
        rule_version=_DEFAULT_RULE_VERSION,
        rules=db_rules if db_rules else None,
    )

    # Persist findings to DB
    for ef in eval_findings:
        from app.models.workflow_b import Finding as FindingModel
        finding = FindingModel(
            upload_id=upload_id,
            site_id=_site_id,
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
        )
        session.add(finding)

    # Calculate wellness index from findings
    finding_dicts = [
        {
            "metric_name": f.metric_name.value if hasattr(f.metric_name, "value") else str(f.metric_name),
            "threshold_band": f.threshold_band.value if hasattr(f.threshold_band, "value") else str(f.threshold_band),
        }
        for f in eval_findings
    ]
    wellness_score = calculate_wellness_index(finding_dicts, _DEFAULT_RULEBOOK_WEIGHTS)
    certification = derive_certification_outcome(wellness_score).value

    upload.rule_version_used = _DEFAULT_RULE_VERSION

    session.add(upload)
    session.commit()
    session.refresh(upload)

    return {
        "upload_id": upload.id,
        "file_name": upload.file_name,
        "site_id": upload.site_id,
        "tenant_id": _tenant_id,
        "parse_status": upload.parse_status.value,
        "parse_outcome": upload.parse_outcome.value if upload.parse_outcome else None,
        "warnings": upload.warnings,
        "uploaded_at": upload.uploaded_at.isoformat(),
        "failed_row_count": parse_result.failed_row_count,
        "report_type": parse_result.report_type.value,
        "finding_count": len(eval_findings),
        "wellness_score": wellness_score,
        "certification_outcome": certification,
        "standards_evaluated": upload.standards_evaluated,
    }


@router.get("/uploads", status_code=status.HTTP_200_OK)
async def list_uploads(session: SessionDep):
    """
    Return a lightweight list of all uploads for the historical scan selector.
    Only includes fields needed by the executive dropdown.
    """
    uploads = session.exec(select(Upload).order_by(Upload.uploaded_at.desc())).all()
    return [
        {
            "id": u.id,
            "file_name": u.file_name,
            "site_id": u.site_id,
            "parse_status": u.parse_status.value,
            "uploaded_at": u.uploaded_at.isoformat(),
            "report_type": u.report_type.value if u.report_type else None,
        }
        for u in uploads
    ]


@router.get("/uploads/{upload_id}", status_code=status.HTTP_200_OK)
async def get_upload(upload_id: str, session: SessionDep):
    """
    Return upload metadata: parseStatus, parseOutcome, warnings, uploadedAt, fileName.
    """
    upload = session.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload {upload_id} not found",
        )

    return {
        "id": upload.id,
        "file_name": upload.file_name,
        "site_id": upload.site_id,
        "parse_status": upload.parse_status.value,
        "parse_outcome": upload.parse_outcome.value if upload.parse_outcome else None,
        "warnings": upload.warnings,
        "uploaded_at": upload.uploaded_at.isoformat(),
        "rule_version_used": upload.rule_version_used,
    }


@router.get("/uploads/{upload_id}/findings", status_code=status.HTTP_200_OK)
async def get_findings(
    upload_id: str,
    session: SessionDep,
    standard_id: str | None = Query(
        default=None,
        description="Filter findings by reference_source.id (certification standard)",
    ),
):
    """
    Return all findings for an upload.
    Enforces QA-G5: returns 422 if any finding is missing ruleVersion or citationUnitIds.
    Optional ?standard_id= filters to findings from a specific certification standard.
    """
    upload = session.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload {upload_id} not found",
        )

    query = select(Finding).where(Finding.upload_id == upload_id)
    if standard_id:
        # Filter by rulebook entries linked to this standard
        from app.models.workflow_a import RulebookEntry

        standard_rule_ids = session.exec(
            select(RulebookEntry.id).where(
                col(RulebookEntry.reference_source_id) == standard_id,
                col(RulebookEntry.approval_status) == "approved",
            )
        ).all()

        if standard_rule_ids:
            # Map rule IDs to rule_ids used in findings via rulebook_entry
            # Since findings store rule_id (not rulebook_entry.id), we need to
            # match via the rulebook entries' rule_id pattern
            # For now, filter findings that have rule_version matching entries from this standard
            standard_entries = session.exec(
                select(RulebookEntry).where(
                    col(RulebookEntry.reference_source_id) == standard_id,
                    col(RulebookEntry.approval_status) == "approved",
                )
            ).all()

            # Get all rule versions used by this standard's entries
            # Findings don't have a direct FK to rulebook_entry, so we match by metric_name
            # and rule_version that corresponds to this standard
            standard_metric_versions = {
                (e.metric_name.value, e.rule_version) for e in standard_entries
            }

            findings = session.exec(query).all()
            findings = [
                f for f in findings
                if (f.metric_name.value, f.rule_version) in standard_metric_versions
            ]
        else:
            findings = []
    else:
        findings = session.exec(query).all()

    # QA-G5 enforcement: check for missing rule_version or citation_unit_ids
    for finding in findings:
        if not finding.rule_version or not finding.citation_unit_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"QA-G5 violation: Finding {finding.id} is missing rule_version or citation_unit_ids",
            )

    return [
        {
            "id": f.id,
            "upload_id": f.upload_id,
            "site_id": f.site_id,
            "zone_name": f.zone_name,
            "metric_name": f.metric_name.value,
            "metric_value": f.metric_value,
            "threshold_band": f.threshold_band.value,
            "interpretation_text": f.interpretation_text,
            "workforce_impact_text": f.workforce_impact_text,
            "recommended_action": f.recommended_action,
            "rule_id": f.rule_id,
            "rule_version": f.rule_version,
            "citation_unit_ids": f.citation_unit_ids,
            "confidence_level": f.confidence_level.value,
            "source_currency_status": f.source_currency_status.value,
            "benchmark_lane": f.benchmark_lane.value,
            "created_at": f.created_at.isoformat(),
            "standard_id": _find_standard_id_for_finding(f, session),
            "standard_title": _find_standard_title_for_finding(f, session),
        }
        for f in findings
    ]


def _find_standard_id_for_finding(finding, session: Session) -> str | None:
    """Find the reference_source.id linked to this finding's rule version."""
    from app.models.workflow_a import RulebookEntry

    entry = session.exec(
        select(RulebookEntry).where(
            col(RulebookEntry.metric_name) == finding.metric_name.value,
            col(RulebookEntry.rule_version) == finding.rule_version,
            col(RulebookEntry.approval_status) == "approved",
        ).limit(1)
    ).first()

    return entry.reference_source_id if entry else None


def _find_standard_title_for_finding(finding, session: Session) -> str | None:
    """Find the standard title linked to this finding's rule version."""
    from app.models.workflow_a import ReferenceSource, RulebookEntry

    result = session.exec(
        select(ReferenceSource.title)
        .join(RulebookEntry, col(ReferenceSource.id) == col(RulebookEntry.reference_source_id))
        .where(
            col(RulebookEntry.metric_name) == finding.metric_name.value,
            col(RulebookEntry.rule_version) == finding.rule_version,
            col(RulebookEntry.approval_status) == "approved",
        ).limit(1)
    ).first()

    return result
