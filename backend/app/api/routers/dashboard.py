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

from app.api.dependencies import SessionDep, TenantIdDep
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
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/dashboard/sites/{site_id}/zones", status_code=status.HTTP_200_OK)
async def get_site_zones(site_id: str, session: SessionDep, tenant_id: TenantIdDep):
    """
    Returns zone/floor drilldown cards for a site.

    Fields: zoneName, metrics[{ metricName, currentValue, unit,
            thresholdBand, sourceCurrencyStatus, benchmarkLane, sparklineData[] }]
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/dashboard/comparison", status_code=status.HTTP_200_OK)
async def get_cross_site_comparison(session: SessionDep, tenant_id: TenantIdDep):
    """
    Cross-site comparison leaderboard.
    Sorted by wellnessIndexScore DESC.

    Fields: siteId, siteName, wellnessIndexScore, certificationOutcome, lastScanDate
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/dashboard/summary", status_code=status.HTTP_200_OK)
async def get_daily_summary(session: SessionDep, tenant_id: TenantIdDep):
    """
    Daily summary card.

    Fields: top3Risks[], top3Actions[], nextVerificationDate, dataAsOf
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


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
    Phase 3:   will filter by tenant_id from JWT.
    """
    try:
        data = agg_svc.get_executive_dashboard(session, site_ids)
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
