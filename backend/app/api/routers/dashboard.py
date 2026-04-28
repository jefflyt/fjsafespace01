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

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import col, select

from app.api.dependencies import SessionDep, TenantIdDep
from app.models.workflow_b import Finding, Reading, Site
from app.schemas.dashboard import ExecutiveDashboardResponse
from app.services import aggregation as agg_svc

router = APIRouter()


@router.get("/dashboard/sites", status_code=status.HTTP_200_OK)
async def get_sites(session: SessionDep, tenant_id: TenantIdDep):
    """
    Returns site summary cards for all sites visible to the caller.
    Phase 1/2: returns all sites.
    Phase 3:   scoped to tenant_id from JWT.

    Fields: siteId, siteName, certificationOutcome, wellnessIndexScore,
            top3Risks[], top3Actions[], nextVerificationDate, lastScanDate
    """
    query = select(Site)
    if tenant_id is not None:
        query = query.where(col(Site.tenant_id) == tenant_id)
    sites = session.exec(query).all()

    rows = []
    for site in sites:
        score, outcome = agg_svc.calculate_site_wellness_index(session, site.id)

        # Get last scan date from most recent finding
        latest_finding = session.exec(
            select(Finding)
            .where(col(Finding.site_id) == site.id)
            .order_by(col(Finding.created_at).desc())
            .limit(1)
        ).first()

        rows.append({
            "site_id": site.id,
            "site_name": site.name,
            "certification_outcome": outcome.value,
            "wellness_index_score": score,
            "last_scan_date": latest_finding.created_at.isoformat() if latest_finding else None,
        })

    return rows


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
