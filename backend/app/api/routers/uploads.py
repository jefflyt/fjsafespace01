"""
backend/app/api/routers/uploads.py

Upload routes — Workflow B entry point.

POST /api/uploads
    Accepts a CSV file + siteId.  Synchronously: parse → validate →
    normalise → rule evaluate → write findings to DB.
    Returns upload summary with findingCount and any warnings.

POST /api/uploads/preview
    Parse CSV to extract zone names without creating any DB records.
    Returns list of zones and dedup status.

POST /api/uploads/confirm
    Create UploadBatch + child uploads based on zone mapping.
    Returns batch_id and list of child upload results.

GET /api/uploads/{upload_id}
    Returns upload metadata and parse status.

GET /api/uploads/{upload_id}/findings
    Returns all findings for an upload.
    Returns 422 if any finding is missing rule_version or citation_unit_ids
    (enforces QA-G5 / Differentiation Requirement D1).

Reference: TDD §4.1
"""

import hashlib
import json
import re
import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, HTTPException, Query, UploadFile, status, Form
from sqlmodel import Session, col, select, text

from app.api.dependencies import SessionDep, TenantIdDep
from app.models.enums import ParseStatus
from app.models.supporting import Tenant
from app.models.workflow_b import Finding, Reading, Upload, UploadBatch, Site
from app.skills.data_ingestion.csv_parser import parse_csv, extract_zones
from app.skills.data_ingestion.supabase_storage import SupabaseStorage, SupabaseStorageError
from app.skills.iaq_rule_governor.rule_engine import evaluate_readings
from app.skills.iaq_rule_governor.wellness_index import calculate_wellness_index, derive_certification_outcome
from app.services.db_rule_service import fetch_rules_by_standard

router = APIRouter()

# R1: Default rule version — matches seed_rulebook_v1.py
_DEFAULT_RULE_VERSION = "v2-refactor"

# Max upload size: 10MB for CSV files
_MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB

# Weights sourced from rulebook_entry index_weight_percent for v2-refactor.
_DEFAULT_RULEBOOK_WEIGHTS: dict[str, float] = {
    "co2_ppm": 25.0,
    "pm25_ugm3": 20.0,
    "tvoc_ppb": 15.0,
    "temperature_c": 10.0,
    "humidity_rh": 10.0,
}


def _upload_file_to_storage(file_bytes: bytes, upload_id: str, filename: str) -> str:
    """Upload file bytes to Supabase Storage. Returns storage path."""
    safe_filename = re.sub(r'[\[\]{}^%`~#|\\]', '_', filename)
    storage_path = f"uploads/{upload_id}/{safe_filename}"
    storage = SupabaseStorage()
    storage.upload_file(file_bytes, storage_path)
    return storage_path


def _process_single_upload(
    session: Session,
    file_bytes: bytes,
    site_id: str,
    upload_id: str,
    batch_id: str | None = None,
    zone_list: list[str] | None = None,
    standards_evaluated: list[str] | None = None,
    tenant_id: str | None = None,
    file_name: str = "upload.csv",
) -> dict:
    """
    Shared processing pipeline: upload to storage → parse → evaluate → persist.
    Used by both POST /uploads (single-zone) and POST /uploads/confirm (multi-zone).

    Returns upload result dict.
    """
    # Upload to Supabase Storage
    try:
        _upload_file_to_storage(file_bytes, upload_id, file_name)
    except SupabaseStorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store file: {str(e)}",
        )

    # Parse CSV
    try:
        parse_result = parse_csv(
            BytesIO(file_bytes),
            site_id=site_id,
            upload_id=upload_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CSV parsing failed: {str(e)}",
        )

    # Filter rows by zone_list if specified (multi-zone split)
    rows_to_persist = parse_result.normalised_rows
    if zone_list:
        rows_to_persist = [r for r in rows_to_persist if r.get("zone_name") in zone_list]

    # Derive scan_date from earliest reading timestamp
    scan_date = None
    if rows_to_persist:
        timestamps = [r["reading_timestamp"] for r in rows_to_persist if r.get("reading_timestamp")]
        if timestamps:
            scan_date = min(timestamps)

    # Create upload record
    upload = Upload(
        id=upload_id,
        site_id=site_id,
        file_name=file_name,
        uploaded_by="anonymous",
        uploaded_at=datetime.utcnow(),
        parse_status=ParseStatus.COMPLETE,
        parse_outcome=parse_result.parse_outcome,
        report_type=parse_result.report_type,
        standards_evaluated=standards_evaluated,
        content_hash=hashlib.sha256(file_bytes).hexdigest(),
        batch_id=batch_id,
        zone_list=zone_list,
        scan_date=scan_date,
        warnings=", ".join(parse_result.warnings) if parse_result.warnings else None,
    )
    session.add(upload)

    # Persist readings
    for row in rows_to_persist:
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

    # Fetch active standards and evaluate per-standard
    from app.models.workflow_a import ReferenceSource
    active_sources = session.exec(
        select(ReferenceSource).where(
            col(ReferenceSource.source_currency_status) == "CURRENT_VERIFIED"
        )
    ).all()

    eval_findings: list = []
    standards_evaluated: list[str] = []

    for source in active_sources:
        std_rules = fetch_rules_by_standard(session, source.id, _DEFAULT_RULE_VERSION)
        if not std_rules:
            continue

        std_findings = evaluate_readings(
            rows_to_persist,
            site_id=site_id,
            upload_id=upload_id,
            rule_version=_DEFAULT_RULE_VERSION,
            rules=std_rules,
        )
        eval_findings.extend(std_findings)
        standards_evaluated.append(source.id)

    # Persist findings
    from app.models.workflow_b import Finding as FindingModel
    for ef in eval_findings:
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
            reference_source_id=ef.reference_source_id,
        )
        session.add(finding)

    # Calculate wellness index
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
    upload.standards_evaluated = standards_evaluated

    session.commit()
    session.refresh(upload)

    # Get site name
    site = session.get(Site, site_id)
    site_name = site.name if site else "Unknown"

    return {
        "upload_id": upload.id,
        "file_name": upload.file_name,
        "site_id": upload.site_id,
        "site_name": site_name,
        "tenant_id": tenant_id,
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
        "is_duplicate": False,
    }


@router.post("/uploads/preview", status_code=status.HTTP_200_OK)
async def preview_upload(
    session: SessionDep,
    file: UploadFile,
    tenant_id: str | None = Form(default=None),
):
    """
    Parse CSV to extract zone names without creating any DB records.
    Checks content hash for dedup at tenant level.

    Response: { zones: ["Lobby", "Outside", ...], is_duplicate: bool }
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV file too large. Maximum size is {_MAX_UPLOAD_SIZE // (1024 * 1024)}MB.",
        )
    zones = extract_zones(BytesIO(file_bytes))

    if not zones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No zone names found in CSV. Ensure the 'Site' column exists with zone/site names.",
        )

    # Check for duplicate at tenant level
    content_hash = hashlib.sha256(file_bytes).hexdigest()
    is_duplicate = False

    if tenant_id:
        existing = _check_dedup_with_session(session, tenant_id, content_hash)
        if existing:
            is_duplicate = True

    return {
        "zones": zones,
        "file_name": file.filename,
        "content_hash": content_hash,
        "is_duplicate": is_duplicate,
    }


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def create_upload(
    session: SessionDep,
    jwt_tenant_id: TenantIdDep,
    file: UploadFile,
    tenant_id: str | None = Form(default=None),
    site_id: str | None = Form(default=None),
    standards: str | None = Form(default=None),
    force: bool = Form(default=False),
):
    """
    Accept a CSV export from uHoo, parse, validate, evaluate against the
    active Rulebook version, store findings, and return the upload summary.

    R1-10: Always creates an UploadBatch + single child Upload (universal batch model).
    """
    # Validate content type
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV file too large. Maximum size is {_MAX_UPLOAD_SIZE // (1024 * 1024)}MB.",
        )

    # Determine tenant
    _tenant_id = tenant_id or jwt_tenant_id

    # Determine or create site
    _site_id = _resolve_site(session, _tenant_id, site_id, file.filename)

    # Dedup check
    content_hash = hashlib.sha256(file_bytes).hexdigest()
    if _tenant_id:
        existing = _check_dedup_with_session(session, _tenant_id, content_hash)
        if existing:
            if force:
                _delete_upload_and_children(session, existing)
            else:
                return _build_duplicate_response(existing, _tenant_id, session)

    # Parse optional standards
    standards_evaluated = None
    if standards:
        try:
            standards_evaluated = json.loads(standards)
        except (json.JSONDecodeError, TypeError):
            standards_evaluated = None

    # Create batch + child upload
    batch_id = str(uuid.uuid4())
    batch = UploadBatch(
        id=batch_id,
        file_name=file.filename,
        tenant_id=_tenant_id,
        content_hash=content_hash,
    )
    session.add(batch)
    session.commit()

    upload_id = str(uuid.uuid4())
    result = _process_single_upload(
        session=session,
        file_bytes=file_bytes,
        site_id=_site_id,
        upload_id=upload_id,
        batch_id=batch_id,
        zone_list=None,  # Will be set after zone extraction
        standards_evaluated=standards_evaluated,
        tenant_id=_tenant_id,
        file_name=file.filename,
    )

    # Update batch with child upload id and zone list
    _ = extract_zones(BytesIO(file_bytes))
    batch.child_upload_ids = [upload_id]
    session.add(batch)
    session.commit()

    return result


@router.post("/uploads/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_upload(
    session: SessionDep,
    jwt_tenant_id: TenantIdDep,
    file: UploadFile,
    tenant_id: str | None = Form(default=None),
    zone_mapping: str | None = Form(default=None),
    standards: str | None = Form(default=None),
):
    """
    Create UploadBatch + child uploads based on zone mapping.

    zone_mapping: JSON string, e.g.
      {"Lobby": "existing-site-uuid", "Outside": "__new__:Outside POD"}

    Response: { batch_id, children: [{ upload_id, site_id, site_name, ... }] }
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV",
        )

    if not zone_mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="zone_mapping is required for confirm upload",
        )

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV file too large. Maximum size is {_MAX_UPLOAD_SIZE // (1024 * 1024)}MB.",
        )
    content_hash = hashlib.sha256(file_bytes).hexdigest()

    _tenant_id = tenant_id or jwt_tenant_id

    try:
        mapping = json.loads(zone_mapping)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="zone_mapping must be valid JSON",
        )

    # Parse optional standards
    standards_evaluated = None
    if standards:
        try:
            standards_evaluated = json.loads(standards)
        except (json.JSONDecodeError, TypeError):
            standards_evaluated = None

    # Group zones by target site
    site_groups: dict[str, list[str]] = {}
    new_sites: dict[str, str] = {}  # zone_name -> new site name

    for zone_name, target in mapping.items():
        if target.startswith("__new__:"):
            new_site_name = target[len("__new__:"):]
            site_key = f"__new__:{new_site_name}"
            if site_key not in site_groups:
                site_groups[site_key] = []
                new_sites[site_key] = new_site_name
            site_groups[site_key].append(zone_name)
        else:
            # Verify site exists
            existing_site = session.get(Site, target)
            if not existing_site:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Site {target} not found",
                )
            if target not in site_groups:
                site_groups[target] = []
            site_groups[target].append(zone_name)

    # Create batch
    batch_id = str(uuid.uuid4())
    batch = UploadBatch(
        id=batch_id,
        file_name=file.filename,
        tenant_id=_tenant_id,
        content_hash=content_hash,
    )
    session.add(batch)
    session.commit()

    # Process each site group
    children = []
    child_ids = []

    for site_key, zones in site_groups.items():
        if site_key.startswith("__new__:"):
            # Create new site
            new_site_name = new_sites[site_key]
            new_site_id = str(uuid.uuid4())
            session.execute(
                text(
                    "INSERT INTO site (id, name, tenant_id, created_at) "
                    "VALUES (:id, :name, :tenant_id, NOW())"
                ),
                {
                    "id": new_site_id,
                    "name": new_site_name,
                    "tenant_id": _tenant_id,
                },
            )
            _site_id = new_site_id
        else:
            _site_id = site_key

        upload_id = str(uuid.uuid4())
        result = _process_single_upload(
            session=session,
            file_bytes=file_bytes,
            site_id=_site_id,
            upload_id=upload_id,
            batch_id=batch_id,
            zone_list=zones,
            standards_evaluated=standards_evaluated,
            tenant_id=_tenant_id,
            file_name=file.filename,
        )
        children.append(result)
        child_ids.append(upload_id)

    # Update batch
    batch.child_upload_ids = child_ids
    session.add(batch)
    session.commit()

    return {
        "batch_id": batch_id,
        "file_name": file.filename,
        "children": children,
    }


def _resolve_site(
    session: Session,
    tenant_id: str | None,
    site_id: str | None,
    fallback_name: str,
) -> str:
    """Determine or create a site for the upload."""
    if site_id:
        existing_site = session.get(Site, site_id)
        if not existing_site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Site {site_id} not found",
            )
        return site_id
    elif tenant_id:
        t = session.get(Tenant, tenant_id)
        site_name = (
            f"{t.client_name} — {t.site_address}"
            if t and t.site_address
            else (t.client_name if t else fallback_name)
        )
        new_site_id = str(uuid.uuid4())
        session.execute(
            text(
                "INSERT INTO site (id, name, tenant_id, created_at) "
                "VALUES (:id, :name, :tenant_id, NOW())"
            ),
            {
                "id": new_site_id,
                "name": site_name,
                "tenant_id": tenant_id,
            },
        )
        return new_site_id
    else:
        new_site_id = str(uuid.uuid4())
        session.execute(
            text(
                "INSERT INTO site (id, name, tenant_id, created_at) "
                "VALUES (:id, :name, NULL, NOW())"
            ),
            {
                "id": new_site_id,
                "name": fallback_name,
            },
        )
        return new_site_id


def _delete_upload_and_children(session: Session, upload: Upload) -> None:
    """Delete an Upload and all its associated readings and findings."""
    session.execute(
        text("DELETE FROM finding WHERE upload_id = :uid"),
        {"uid": upload.id},
    )
    session.execute(
        text("DELETE FROM reading WHERE upload_id = :uid"),
        {"uid": upload.id},
    )
    session.delete(upload)
    session.commit()


def _check_dedup_with_session(
    session: Session,
    tenant_id: str,
    content_hash: str,
) -> Upload | None:
    """Check if a tenant already has an upload with this content hash."""
    existing = session.exec(
        select(Upload).where(
            col(Upload.content_hash) == content_hash,
            col(Upload.site_id).in_(
                select(col(Site.id)).where(
                    col(Site.tenant_id) == tenant_id
                )
            ),
            col(Upload.parse_status) == ParseStatus.COMPLETE,
        )
    ).first()
    return existing


def _build_duplicate_response(
    existing: Upload,
    tenant_id: str,
    session: Session,
) -> dict:
    """Build response for a duplicate upload."""
    finding_count = session.exec(
        select(text("COUNT(*)")).select_from(Finding).where(
            col(Finding.upload_id) == existing.id
        )
    ).one()

    return {
        "upload_id": existing.id,
        "file_name": existing.file_name,
        "site_id": existing.site_id,
        "tenant_id": tenant_id,
        "parse_status": existing.parse_status.value,
        "parse_outcome": existing.parse_outcome.value if existing.parse_outcome else None,
        "warnings": existing.warnings,
        "uploaded_at": existing.uploaded_at.isoformat(),
        "failed_row_count": 0,
        "report_type": existing.report_type.value if existing.report_type else None,
        "finding_count": finding_count or 0,
        "wellness_score": None,
        "certification_outcome": None,
        "standards_evaluated": existing.standards_evaluated,
        "is_duplicate": True,
        "duplicate_of": existing.id,
    }


@router.get("/uploads", status_code=status.HTTP_200_OK)
async def list_uploads(
    session: SessionDep,
    site_id: str | None = Query(default=None, description="Filter uploads by site ID"),
    site_ids: str | None = Query(default=None, description="Comma-separated site IDs for multi-site fetch"),
):
    """
    Return a lightweight list of uploads for the historical scan selector
    or site scan history.

    Supports single site_id or multiple site_ids (comma-separated).
    Each upload includes `scan_date` (from CSV reading timestamps) and
    `uploaded_at` (when the file was received).
    """
    query = select(Upload)
    if site_ids:
        ids = [s.strip() for s in site_ids.split(',') if s.strip()]
        if ids:
            query = query.where(col(Upload.site_id).in_(ids))
    elif site_id:
        query = query.where(col(Upload.site_id) == site_id)
    query = query.order_by(Upload.uploaded_at.desc())
    uploads = session.exec(query).all()
    return [
        {
            "id": u.id,
            "file_name": u.file_name,
            "site_id": u.site_id,
            "parse_status": u.parse_status.value,
            "uploaded_at": u.uploaded_at.isoformat(),
            "scan_date": u.scan_date.isoformat() if u.scan_date else None,
            "report_type": u.report_type.value if u.report_type else None,
            "scan_type": u.scan_type,
            "standards_evaluated": u.standards_evaluated or [],
            "content_hash": u.content_hash,
            "is_duplicate": False,
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
        from app.models.workflow_a import RulebookEntry

        standard_rule_ids = session.exec(
            select(RulebookEntry.id).where(
                col(RulebookEntry.reference_source_id) == standard_id,
                col(RulebookEntry.approval_status) == "approved",
            )
        ).all()

        if standard_rule_ids:
            standard_entries = session.exec(
                select(RulebookEntry).where(
                    col(RulebookEntry.reference_source_id) == standard_id,
                    col(RulebookEntry.approval_status) == "approved",
                )
            ).all()

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

    # QA-G5 enforcement
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


# ── R1-12: Scan Data View — Readings with zone filter ─────────────────────


@router.get("/uploads/{upload_id}/readings", status_code=status.HTTP_200_OK)
async def get_upload_readings(
    upload_id: str,
    session: SessionDep,
    zone_name: str | None = Query(default=None),
):
    """
    Return all readings for an upload, grouped by metric.
    Optional ?zone_name= filters to a specific zone.
    Each metric entry contains: zone_name, timestamp, metric_value, is_outlier.
    Sorted by timestamp ascending for time-series charts.
    """
    query = select(Reading).where(col(Reading.upload_id) == upload_id)
    if zone_name:
        query = query.where(col(Reading.zone_name) == zone_name)
    query = query.order_by(col(Reading.reading_timestamp))

    readings = session.exec(query).all()

    by_metric: dict[str, list[dict]] = {}
    for r in readings:
        metric = r.metric_name.value if hasattr(r.metric_name, "value") else str(r.metric_name)
        if metric not in by_metric:
            by_metric[metric] = []
        by_metric[metric].append({
            "zone_name": r.zone_name,
            "timestamp": r.reading_timestamp.strftime("%d/%m/%y %H:%M"),
            "metric_value": r.metric_value,
            "is_outlier": r.is_outlier,
        })

    return {
        "upload_id": upload_id,
        "metrics": by_metric,
    }


# ── R1-12: Scan Data View — Trend Comparison ─────────────────────────────


@router.get("/uploads/{upload_id}/trend-comparison", status_code=status.HTTP_200_OK)
async def get_trend_comparison(upload_id: str, session: SessionDep):
    """
    Compare current upload's average metric values vs previous upload
    for the same site. Returns pct_change per metric.

    Response: {
        upload_id, previous_upload_id,
        metrics: { metric_name: { current_avg, previous_avg, pct_change } }
    }
    """
    upload = session.get(Upload, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload {upload_id} not found",
        )

    # Find previous upload for the same site
    previous_uploads = session.exec(
        select(Upload)
        .where(
            col(Upload.site_id) == upload.site_id,
            col(Upload.id) != upload_id,
        )
        .order_by(col(Upload.uploaded_at).desc())
    ).all()

    if not previous_uploads:
        return {
            "upload_id": upload_id,
            "previous_upload_id": None,
            "metrics": {},
        }

    previous = previous_uploads[0]

    # Fetch current readings
    current_readings = session.exec(
        select(Reading)
        .where(col(Reading.upload_id) == upload_id)
    ).all()

    # Fetch previous readings
    previous_readings = session.exec(
        select(Reading)
        .where(col(Reading.upload_id) == previous.id)
    ).all()

    # Compute averages per metric for current
    current_avgs: dict[str, float] = {}
    current_sums: dict[str, float] = {}
    current_counts: dict[str, int] = {}
    for r in current_readings:
        metric = r.metric_name.value if hasattr(r.metric_name, "value") else str(r.metric_name)
        current_sums[metric] = current_sums.get(metric, 0) + r.metric_value
        current_counts[metric] = current_counts.get(metric, 0) + 1
    for metric, total in current_sums.items():
        current_avgs[metric] = total / current_counts[metric] if current_counts[metric] > 0 else 0

    # Compute averages per metric for previous
    previous_avgs: dict[str, float] = {}
    previous_sums: dict[str, float] = {}
    previous_counts: dict[str, int] = {}
    for r in previous_readings:
        metric = r.metric_name.value if hasattr(r.metric_name, "value") else str(r.metric_name)
        previous_sums[metric] = previous_sums.get(metric, 0) + r.metric_value
        previous_counts[metric] = previous_counts.get(metric, 0) + 1
    for metric, total in previous_sums.items():
        previous_avgs[metric] = total / previous_counts[metric] if previous_counts[metric] > 0 else 0

    # Compute pct_change for metrics present in both
    all_metrics = set(current_avgs.keys()) | set(previous_avgs.keys())
    metrics_result: dict[str, dict] = {}
    for metric in sorted(all_metrics):
        current_avg = round(current_avgs.get(metric, 0), 2)
        previous_avg = round(previous_avgs.get(metric, 0), 2)
        entry: dict = {
            "current_avg": current_avg,
            "previous_avg": previous_avg,
        }
        if previous_avg != 0:
            entry["pct_change"] = round((current_avg - previous_avg) / abs(previous_avg) * 100, 1)
        metrics_result[metric] = entry

    return {
        "upload_id": upload_id,
        "previous_upload_id": previous.id,
        "metrics": metrics_result,
    }


# ── R1-12: Scan Data View — Anomaly Summary ─────────────────────────────


@router.get("/uploads/{upload_id}/anomalies", status_code=status.HTTP_200_OK)
async def get_anomalies(upload_id: str, session: SessionDep):
    """
    Return detected anomalies from the upload's readings.
    Uses existing is_outlier flag + heuristic detection (sudden >2x changes).

    Response: { anomalies: [{ metric_name, zone_name, timestamp, type, value, description }] }
    """
    readings = session.exec(
        select(Reading)
        .where(col(Reading.upload_id) == upload_id)
        .order_by(col(Reading.reading_timestamp))
    ).all()

    if not readings:
        return {"anomalies": []}

    # Group readings by (metric_name, zone_name) for per-zone averaging
    zone_metric_values: dict[tuple[str, str], list[float]] = {}
    for r in readings:
        metric = r.metric_name.value if hasattr(r.metric_name, "value") else str(r.metric_name)
        key = (metric, r.zone_name)
        zone_metric_values.setdefault(key, []).append(r.metric_value)

    # Compute per-zone per-metric averages
    zone_metric_avgs: dict[tuple[str, str], float] = {}
    for key, values in zone_metric_values.items():
        zone_metric_avgs[key] = sum(values) / len(values) if values else 0

    anomalies: list[dict] = []
    for r in readings:
        metric = r.metric_name.value if hasattr(r.metric_name, "value") else str(r.metric_name)
        zone_avg = zone_metric_avgs.get((metric, r.zone_name), 0)

        # Determine anomaly type
        if r.is_outlier:
            # Use heuristic to classify
            if zone_avg > 0 and r.metric_value > zone_avg * 2:
                anomaly_type = "spike"
            elif zone_avg > 0 and r.metric_value < zone_avg * 0.5:
                anomaly_type = "drop"
            else:
                anomaly_type = "outlier"
        else:
            continue  # Skip non-outlier readings

        # Build plain-language description
        ts = r.reading_timestamp
        time_str = ts.strftime("%-I:%M %p").lstrip("0") if ts else "unknown time"
        metric_label = metric.replace("_ppm", "").replace("_ppb", "").replace("_ugm3", "").replace("_hpa", "").replace("_dba", "").replace("_rh", "").replace("_c", "").upper()
        zone_label = r.zone_name or "Unknown zone"

        if anomaly_type == "spike":
            desc = f"{metric_label} spike detected in {zone_label} at {time_str}"
        elif anomaly_type == "drop":
            desc = f"{metric_label} drop detected in {zone_label} at {time_str}"
        else:
            desc = f"{metric_label} anomaly detected in {zone_label} at {time_str}"

        anomalies.append({
            "metric_name": metric,
            "zone_name": r.zone_name,
            "timestamp": r.reading_timestamp.isoformat() if r.reading_timestamp else None,
            "type": anomaly_type,
            "value": r.metric_value,
            "description": desc,
        })

    return {"anomalies": anomalies}


# ── R1-12: Scan Data View — Latest Upload for Site ───────────────────────


@router.get("/sites/{site_id}/latest-upload", status_code=status.HTTP_200_OK)
async def get_latest_upload_for_site(site_id: str, session: SessionDep):
    """
    Return the latest upload ID for a given site.
    Used by the Scan Data View to find readings without knowing the upload ID.
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found",
        )

    latest = session.exec(
        select(Upload)
        .where(col(Upload.site_id) == site_id)
        .order_by(col(Upload.uploaded_at).desc())
        .limit(1)
    ).first()

    if not latest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No uploads found for site {site_id}",
        )

    return {
        "upload_id": latest.id,
        "site_id": site_id,
        "site_name": site.name,
    }


def _find_standard_id_for_finding(finding, session: Session) -> str | None:
    """Find the reference_source.id linked to this finding.

    Uses finding.reference_source_id directly (set at evaluation time).
    Falls back to a best-effort lookup for legacy findings without it.
    """
    if finding.reference_source_id:
        return finding.reference_source_id

    from app.models.workflow_a import RulebookEntry
    from app.services.db_rule_service import extract_band_from_rule_id

    band = extract_band_from_rule_id(finding.rule_id)

    entries = session.exec(
        select(RulebookEntry).where(
            col(RulebookEntry.metric_name) == finding.metric_name.value,
            col(RulebookEntry.rule_version) == finding.rule_version,
            col(RulebookEntry.approval_status) == "approved",
        )
    ).all()

    if not entries:
        return None

    # Try to match by band for more precise attribution
    matching_entries = []
    for entry in entries:
        from app.services.db_rule_service import _resolve_band
        if band and _resolve_band(entry, entries) == band:
            matching_entries.append(entry)

    if not matching_entries:
        matching_entries = list(entries)

    # If only one standard defines this metric, use it directly
    unique_sources = {e.reference_source_id for e in matching_entries}
    if len(unique_sources) == 1:
        return matching_entries[0].reference_source_id

    # For metrics defined by multiple standards (CO2, PM25):
    # - Prefer CURRENT_VERIFIED sources
    # - For RESET: humidity is RESET-only, use as anchor
    from app.models.workflow_a import ReferenceSource
    for entry in matching_entries:
        source = session.get(ReferenceSource, entry.reference_source_id)
        if source and source.source_currency_status == "CURRENT_VERIFIED":
            return entry.reference_source_id

    # Last resort: return first match
    return matching_entries[0].reference_source_id


def _find_standard_title_for_finding(finding, session: Session) -> str | None:
    """Find the standard title linked to this finding.

    Uses finding.reference_source_id directly, with fallback for legacy data.
    """
    source_id = _find_standard_id_for_finding(finding, session)
    if not source_id:
        return None

    from app.models.workflow_a import ReferenceSource
    result = session.exec(
        select(ReferenceSource.title)
        .where(col(ReferenceSource.id) == source_id)
    ).first()

    return result
