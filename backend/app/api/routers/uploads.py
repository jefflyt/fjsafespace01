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
from sqlmodel import Session, select

from app.api.dependencies import SessionDep
from app.models.enums import ParseOutcome, ParseStatus
from app.models.workflow_b import Finding, Upload
from app.skills.data_ingestion.csv_parser import parse_csv
from app.skills.data_ingestion.supabase_storage import SupabaseStorage, SupabaseStorageError
from app.skills.iaq_rule_governor.rule_engine import evaluate_readings
from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index, derive_certification_outcome

router = APIRouter()

# Phase 1 default rule version
_DEFAULT_RULE_VERSION = "v1"

# Default rulebook weights for wellness index (sums to 100)
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
    site_id: str,
    context: str | None = None,
):
    """
    Accept a CSV export from uHoo, parse, validate, evaluate against the
    active Rulebook version, store findings, and return the upload summary.
    """
    # Validate content type
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
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
    file_bytes = await file.read()

    # Upload to Supabase Storage
    try:
        storage = SupabaseStorage()
        storage_path = f"uploads/{upload_id}/{file.filename}"
        file_url = storage.upload_file(file_bytes, storage_path)
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

    # Evaluate readings against rulebook to generate findings
    eval_findings = evaluate_readings(
        parse_result.normalised_rows,
        site_id=site_id,
        upload_id=upload_id,
        rule_version=_DEFAULT_RULE_VERSION,
    )

    # Persist findings to DB
    for ef in eval_findings:
        from app.models.workflow_b import Finding as FindingModel
        finding = FindingModel(
            upload_id=upload_id,
            site_id=site_id,
            zone_name=ef.zone_name,
            metric_name=ef.metric_name,
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
        "finding_count": len(eval_findings),
        "wellness_score": wellness_score,
        "certification_outcome": certification,
    }


@router.get("/uploads", status_code=status.HTTP_200_OK)
async def list_uploads(session: SessionDep):
    """
    Return a list of all uploads with their parse status and outcome.
    """
    uploads = session.exec(select(Upload).order_by(Upload.uploaded_at.desc())).all()
    return [
        {
            "id": u.id,
            "file_name": u.file_name,
            "site_id": u.site_id,
            "parse_status": u.parse_status.value,
            "parse_outcome": u.parse_outcome.value if u.parse_outcome else None,
            "uploaded_at": u.uploaded_at.isoformat(),
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
