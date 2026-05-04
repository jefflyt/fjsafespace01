"""
backend/app/api/routers/dashboard.py

Dashboard aggregation routes — Workflow B read layer.

GET /api/dashboard/sites
GET /api/dashboard/sites/{site_id}/zones
GET /api/dashboard/comparison
GET /api/dashboard/summary
GET /api/dashboard/executive          (PR 6.2 — Executive Dashboard)

IMPORTANT: certificationOutcome must never be null.
If no valid applicable rule set exists, return INSUFFICIENT_EVIDENCE.

Reference: TDD §4.2
"""

import sqlalchemy as sa
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import col, select

from app.api.dependencies import SessionDep, TenantIdDep
from app.models.supporting import Tenant
from app.models.workflow_a import RulebookEntry
from app.models.workflow_b import Finding, Reading, Report, Site, Upload
from app.schemas.dashboard import ExecutiveDashboardResponse
from app.services import aggregation as agg_svc

router = APIRouter()


@router.get("/dashboard/sites", status_code=status.HTTP_200_OK)
async def get_sites(session: SessionDep, tenant_id: TenantIdDep):
    """
    Returns site summary cards for all sites visible to the caller.
    Enriched for UI Refresh (PR-R1-09): includes tenant_name, scan_type,
    latest upload_id, and standards_evaluated.

    All queries are batched — single upfront fetches for tenants, uploads,
    reports, and findings. No N+1 pattern.
    """
    query = select(Site)
    if tenant_id is not None:
        query = query.where(col(Site.tenant_id) == tenant_id)
    sites = session.exec(query).all()

    if not sites:
        return []

    site_ids = [s.id for s in sites]

    # ── Batch fetch tenants ──────────────────────────────────────────────
    tenant_ids = [s.tenant_id for s in sites if s.tenant_id]
    tenants = {}
    if tenant_ids:
        for t in session.exec(select(Tenant).where(col(Tenant.id).in_(tenant_ids))).all():
            tenants[t.id] = t.client_name or t.tenant_name

    # ── Batch fetch latest upload per site ──────────────────────────────
    uploads = session.exec(
        select(Upload)
        .where(col(Upload.site_id).in_(site_ids))
        .order_by(col(Upload.uploaded_at).desc())
    ).all()
    latest_upload_by_site: dict[str, Upload] = {}
    for u in uploads:
        if u.site_id not in latest_upload_by_site:
            latest_upload_by_site[u.site_id] = u

    # ── Batch fetch latest report per site (for rule_version) ────────────
    reports = session.exec(
        select(Report)
        .where(col(Report.site_id).in_(site_ids))
        .order_by(col(Report.generated_at).desc())
    ).all()
    latest_report_by_site: dict[str, Report] = {}
    for r in reports:
        if r.site_id not in latest_report_by_site:
            latest_report_by_site[r.site_id] = r

    # ── Batch fetch findings per site ──────────────────────────────────
    findings = session.exec(
        select(Finding)
        .where(col(Finding.site_id).in_(site_ids))
        .order_by(col(Finding.created_at).desc())
    ).all()
    findings_by_site: dict[str, list[dict]] = {}
    latest_finding_by_site: dict[str, Finding] = {}
    for f in findings:
        if f.site_id not in findings_by_site:
            findings_by_site[f.site_id] = []
            latest_finding_by_site[f.site_id] = f
        findings_by_site[f.site_id].append({
            "metric_name": f.metric_name.value,
            "threshold_band": f.threshold_band.value,
        })

    # ── Batch fetch upload count per site ──────────────────────────────
    upload_counts = session.exec(
        select(Upload.site_id, sa.func.count(Upload.id).label("count"))
        .where(col(Upload.site_id).in_(site_ids))
        .group_by(Upload.site_id)
    ).all()
    upload_count_by_site: dict[str, int] = {row[0]: row[1] for row in upload_counts}

    # ── Batch fetch earliest reading timestamp per site ────────────────
    earliest_readings = session.exec(
        select(Reading.site_id, sa.func.min(Reading.reading_timestamp).label("first_scan"))
        .where(col(Reading.site_id).in_(site_ids))
        .group_by(Reading.site_id)
    ).all()
    first_scan_by_site: dict[str, datetime] = {row[0]: row[1] for row in earliest_readings}

    # ── Batch fetch rulebook weights per rule_version ─────────────────────
    rule_versions = set()
    for report in latest_report_by_site.values():
        if report.rule_version_used:
            rule_versions.add(report.rule_version_used)

    weights_by_version: dict[str, dict[str, float]] = {}
    if rule_versions:
        entries = session.exec(
            select(RulebookEntry)
            .where(
                col(RulebookEntry.rule_version).in_(rule_versions),
                col(RulebookEntry.index_weight_percent).isnot(None),
                col(RulebookEntry.approval_status) == "approved",
            )
        ).all()
        for entry in entries:
            version = entry.rule_version
            if version not in weights_by_version:
                weights_by_version[version] = {}
            weights_by_version[version][entry.metric_name.value] = entry.index_weight_percent

    # ── Import wellness calculator (local to avoid circular imports) ─────
    from app.skills.iaq_rule_governor.wellness_index import (
        calculate_wellness_index,
        derive_certification_outcome,
    )

    rows = []
    for site in sites:
        tenant_name = tenants.get(site.tenant_id) if site.tenant_id else None
        latest_upload = latest_upload_by_site.get(site.id)
        latest_finding = latest_finding_by_site.get(site.id)
        latest_report = latest_report_by_site.get(site.id)

        # Compute wellness index using batched data
        score = 0.0
        outcome = "INSUFFICIENT_EVIDENCE"
        if latest_report and latest_report.rule_version_used:
            weights = weights_by_version.get(latest_report.rule_version_used)
            site_findings = findings_by_site.get(site.id, [])
            if weights and site_findings:
                score = calculate_wellness_index(site_findings, weights)
                outcome = derive_certification_outcome(score).value

        rows.append({
            "site_id": site.id,
            "site_name": site.name,
            "tenant_name": tenant_name,
            "scan_type": latest_upload.scan_type if latest_upload else "adhoc",
            "upload_id": latest_upload.id if latest_upload else None,
            "uploaded_at": latest_upload.uploaded_at.isoformat() if latest_upload and latest_upload.uploaded_at else None,
            "standards_evaluated": latest_upload.standards_evaluated if latest_upload else [],
            "certification_outcome": outcome,
            "wellness_index_score": score,
            "last_scan_date": latest_finding.created_at.isoformat() if latest_finding else None,
            "scan_count": upload_count_by_site.get(site.id, 0),
            "first_scan_date": first_scan_by_site[site.id].isoformat() if site.id in first_scan_by_site else None,
        })

    # ── Group by site_name — keep latest entry per unique site ───────────
    grouped: dict[str, dict] = {}
    site_ids_by_name: dict[str, list[str]] = {}
    for row in rows:
        name = row["site_name"]
        site_ids_by_name.setdefault(name, []).append(row["site_id"])
        if name not in grouped:
            grouped[name] = row
        else:
            existing = grouped[name]
            new_ts = row.get("uploaded_at") or ""
            old_ts = existing.get("uploaded_at") or ""
            if new_ts > old_ts:
                grouped[name] = row

    for row in grouped.values():
        row["all_site_ids"] = site_ids_by_name.get(row["site_name"], [row["site_id"]])

    return list(grouped.values())


@router.get("/sites/{site_id}", status_code=status.HTTP_200_OK)
async def get_site_detail(site_id: str, session: SessionDep, tenant_id: TenantIdDep):
    """
    Returns site details with tenant/customer information.

    Fields: site_id, site_name, tenant_id, tenant_name,
            tenant contact info, premises_type, site_address
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found.",
        )

    tenant = None
    if site.tenant_id:
        tenant = session.get(Tenant, site.tenant_id)

    return {
        "site_id": site.id,
        "site_name": site.name,
        "tenant_id": site.tenant_id,
        "tenant_name": tenant.client_name if tenant and tenant.client_name else tenant.tenant_name if tenant else None,
        "contact_person": tenant.contact_person if tenant else None,
        "contact_email": tenant.contact_email if tenant else None,
        "site_address": tenant.site_address if tenant else None,
        "premises_type": tenant.premises_type if tenant else None,
        "specific_event": tenant.specific_event if tenant else None,
        "comparative_analysis": tenant.comparative_analysis if tenant else False,
    }


@router.get("/dashboard/sites/{site_id}/zones", status_code=status.HTTP_200_OK)
async def get_site_zones(site_id: str, session: SessionDep, tenant_id: TenantIdDep):
    """
    Returns zone/floor drilldown cards for a site.

    Fields: zoneName, metrics[{ metricName, currentValue, unit,
            thresholdBand, sourceCurrencyStatus, benchmarkLane, sparklineData[] }]
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found.",
        )

    findings = session.exec(
        select(Finding).where(col(Finding.site_id) == site_id)
    ).all()

    if not findings:
        return {"site_id": site_id, "site_name": site.name, "zones": []}

    # Group findings by zone_name
    zones: dict[str, list] = {}
    for f in findings:
        if f.zone_name not in zones:
            zones[f.zone_name] = []
        zones[f.zone_name].append({
            "metric_name": f.metric_name.value,
            "threshold_band": f.threshold_band.value,
            "source_currency_status": f.source_currency_status.value,
            "benchmark_lane": f.benchmark_lane.value,
            "interpretation_text": f.interpretation_text,
        })

    return {
        "site_id": site.id,
        "site_name": site.name,
        "zones": [
            {"zone_name": name, "metrics": metrics}
            for name, metrics in zones.items()
        ],
    }


@router.get("/dashboard/comparison", status_code=status.HTTP_200_OK)
async def get_cross_site_comparison(session: SessionDep, tenant_id: TenantIdDep):
    """
    Cross-site comparison leaderboard.
    Sorted by wellnessIndexScore DESC.

    Fields: siteId, siteName, wellnessIndexScore, certificationOutcome, lastScanDate
    """
    # Build list of tenant-scoped site_ids
    site_ids = None
    if tenant_id is not None:
        tenant_sites = session.exec(
            select(Site.id).where(col(Site.tenant_id) == tenant_id)
        ).all()
        site_ids = list(tenant_sites) if tenant_sites else []

    leaderboard = agg_svc.get_leaderboard(session, site_ids)
    return leaderboard


@router.get("/dashboard/summary", status_code=status.HTTP_200_OK)
async def get_daily_summary(session: SessionDep, tenant_id: TenantIdDep):
    """
    Daily summary card.

    Fields: top3Risks[], top3Actions[], nextVerificationDate, dataAsOf
    """
    # Build list of tenant-scoped site_ids
    site_ids = None
    if tenant_id is not None:
        tenant_sites = session.exec(
            select(Site.id).where(col(Site.tenant_id) == tenant_id)
        ).all()
        site_ids = list(tenant_sites) if tenant_sites else []

    top_risks = agg_svc.get_top_3_risks(session, site_ids)
    top_actions = agg_svc.get_top_3_actions(session, site_ids)

    # Get most recent finding timestamp for dataAsOf
    latest_finding = session.exec(
        select(Finding).order_by(col(Finding.created_at).desc()).limit(1)
    ).first()

    return {
        "top3_risks": top_risks,
        "top3_actions": top_actions,
        "data_as_of": latest_finding.created_at.isoformat() if latest_finding else None,
    }


# ── PR 6.2: Executive Dashboard ──────────────────────────────────────────────


@router.get("/dashboard/executive", response_model=ExecutiveDashboardResponse, status_code=status.HTTP_200_OK)
async def get_executive_dashboard(
    session: SessionDep,
    tenant_id: TenantIdDep,
    site_ids: list[str] | None = Query(default=None, description="Optional filter by site IDs"),
):
    """
    Executive Dashboard aggregation endpoint.

    Returns portfolio-level data:
    - Leaderboard sorted by wellness_index_score DESC
    - Top 3 critical risks (non-advisory first)
    - Top 3 recommended actions
    - Health ratings summary (certified / verified / improvement / insufficient)

    Phase 1/2: aggregates all sites globally (tenant_id is None).
    Phase 3:   filters by tenant_id from JWT.
    """
    # Build list of tenant-scoped site_ids
    tenant_site_ids = site_ids  # start with explicit filter
    if tenant_id is not None and site_ids is None:
        tenant_sites = session.exec(
            select(Site.id).where(col(Site.tenant_id) == tenant_id)
        ).all()
        tenant_site_ids = list(tenant_sites) if tenant_sites else []

    try:
        data = agg_svc.get_executive_dashboard(session, tenant_site_ids)
        return ExecutiveDashboardResponse(
            leaderboard=data["leaderboard"],
            top_risks=data["top_risks"],
            top_actions=data["top_actions"],
            health_ratings=data["health_ratings"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to aggregate executive dashboard data: {exc}",
        )


# ── Readings Time-Series ─────────────────────────────────────────────────────


@router.get("/uploads/{upload_id}/readings", status_code=status.HTTP_200_OK)
async def get_readings(upload_id: str, session: SessionDep):
    """
    Return all readings for an upload, grouped by metric.
    Each metric entry contains: zone_name, timestamp, metric_value, is_outlier.
    Sorted by timestamp ascending for time-series charts.
    """
    readings = session.exec(
        select(Reading)
        .where(col(Reading.upload_id) == upload_id)
        .order_by(col(Reading.reading_timestamp))
    ).all()

    # Group by metric_name
    by_metric: dict[str, list[dict]] = {}
    for r in readings:
        metric = r.metric_name.value if hasattr(r.metric_name, "value") else str(r.metric_name)
        if metric not in by_metric:
            by_metric[metric] = []
        by_metric[metric].append({
            "zone_name": r.zone_name,
            "timestamp": r.reading_timestamp.isoformat(),
            "metric_value": r.metric_value,
            "is_outlier": r.is_outlier,
        })

    return {
        "upload_id": upload_id,
        "metrics": by_metric,
    }
