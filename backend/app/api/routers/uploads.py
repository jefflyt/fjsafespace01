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

from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlmodel import select, text

from app.api.dependencies import SessionDep
from app.models.enums import ParseOutcome, ParseStatus
from app.models.workflow_b import Finding, Reading, Upload
from app.skills.data_ingestion.csv_parser import parse_csv
from app.skills.data_ingestion.supabase_storage import SupabaseStorage, SupabaseStorageError
from app.skills.iaq_rule_governor.rule_engine import evaluate_readings
from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index, derive_certification_outcome
from app.services.db_rule_service import fetch_rules_from_db

router = APIRouter()

# Phase 1 default rule version — matches seed_rulebook_v1.py
_DEFAULT_RULE_VERSION = "v1.0"

# Interim weights for wellness index — will be sourced from DB in a future iteration.
# These match the index_weight_percent values in rulebook_entry for v1.0.
_DEFAULT_RULEBOOK_WEIGHTS: dict[str, float] = {
    "co2_ppm": 25.0,
    "pm25_ugm3": 25.0,
    "tvoc_ppb": 20.0,
    "temperature_c": 15.0,
    "humidity_rh": 15.0,
}


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def create_upload(
    session: SessionDep,
    file: UploadFile,
    client_name: str,
    site_address: str,
    premises_type: str,
    contact_person: str,
    specific_event: str | None = None,
    comparative_analysis: bool = False,
):
    """
    Accept a CSV export from uHoo, parse, validate, evaluate against the
    active Rulebook version, store findings, and return the upload summary.

    PR9: Accepts customer information instead of a manual site_id.
    A site UUID is auto-generated behind the scenes.
    """
    # Validate content type
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    # PR9: Create/find tenant with customer info, then create site linked to tenant
    # Use contact_person as a simple deduplication key for now
    existing_tenant = session.execute(
        text("SELECT id FROM tenant WHERE contact_person = :cp LIMIT 1"),
        {"cp": contact_person},
    ).first()

    if existing_tenant:
        tenant_id = existing_tenant[0]
        # Update customer info on existing tenant
        session.execute(
            text(
                "UPDATE tenant SET client_name = :cn, site_address = :sa, "
                "premises_type = :pt, contact_person = :cp, "
                "specific_event = :se, comparative_analysis = :ca "
                "WHERE id = :id"
            ),
            {
                "cn": client_name,
                "sa": site_address,
                "pt": premises_type,
                "cp": contact_person,
                "se": specific_event,
                "ca": comparative_analysis,
                "id": tenant_id,
            },
        )
    else:
        tenant_id = str(uuid.uuid4())
        session.execute(
            text(
                "INSERT INTO tenant (id, tenant_name, contact_email, client_name, "
                "site_address, premises_type, contact_person, specific_event, "
                "comparative_analysis, created_at) "
                "VALUES (:id, :tn, :ce, :cn, :sa, :pt, :cp, :se, :ca, NOW())"
            ),
            {
                "id": tenant_id,
                "tn": client_name,
                "ce": f"{contact_person.lower().replace(' ', '.')}@example.com",
                "cn": client_name,
                "sa": site_address,
                "pt": premises_type,
                "cp": contact_person,
                "se": specific_event,
                "ca": comparative_analysis,
            },
        )

    # Auto-generate site UUID, linked to tenant
    site_id = str(uuid.uuid4())
    site_name = f"{client_name} — {site_address}"

    session.execute(
        text(
            "INSERT INTO site (id, name, tenant_id, created_at) "
            "VALUES (:id, :name, :tenant_id, NOW())"
        ),
        {
            "id": site_id,
            "name": site_name,
            "tenant_id": tenant_id,
        },
    )

    # Create upload record with PENDING status
    upload_id = str(uuid.uuid4())
    upload = Upload(
        id=upload_id,
        site_id=site_id,
        file_name=file.filename,
        uploaded_by="anonymous",  # Phase 1/2: no auth; Phase 3: extract from JWT
        uploaded_at=datetime.utcnow(),
        parse_status=ParseStatus.PENDING,
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
            site_id=site_id,
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
            site_id=site_id,
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
        site_id=site_id,
        upload_id=upload_id,
        rule_version=_DEFAULT_RULE_VERSION,
        rules=db_rules if db_rules else None,
    )

    # Persist findings to DB
    for ef in eval_findings:
        from app.models.workflow_b import Finding as FindingModel
        finding = FindingModel(
            upload_id=upload_id,
            site_id=site_id,
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
        "parse_status": upload.parse_status.value,
        "parse_outcome": upload.parse_outcome.value if upload.parse_outcome else None,
        "warnings": upload.warnings,
        "uploaded_at": upload.uploaded_at.isoformat(),
        "failed_row_count": parse_result.failed_row_count,
        "report_type": parse_result.report_type.value,
        "finding_count": len(eval_findings),
        "wellness_score": wellness_score,
        "certification_outcome": certification,
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
async def get_findings(upload_id: str, session: SessionDep):
    """
    Return all findings for an upload.
    Enforces QA-G5: returns 422 if any finding is missing ruleVersion or citationUnitIds.
    """
    upload = session.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload {upload_id} not found",
        )

    findings = session.exec(
        select(Finding).where(Finding.upload_id == upload_id)
    ).all()

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
        }
        for f in findings
    ]
