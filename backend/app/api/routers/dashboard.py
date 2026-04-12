"""
backend/app/api/routers/dashboard.py

Dashboard aggregation routes — Workflow B read layer.

GET /api/dashboard/sites
GET /api/dashboard/sites/{site_id}/zones
GET /api/dashboard/comparison
GET /api/dashboard/summary

IMPORTANT: certificationOutcome must never be null.
If no valid applicable rule set exists, return INSUFFICIENT_EVIDENCE.

Reference: TDD §4.2
"""

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import SessionDep, TenantIdDep

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
