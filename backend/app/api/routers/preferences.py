"""
backend/app/api/routers/preferences.py

Site metric preferences and standards management routes.

GET    /api/sites/{site_id}/metric-preferences
PATCH  /api/sites/{site_id}/metric-preferences
GET    /api/sites/{site_id}/standards
POST   /api/sites/{site_id}/standards/{source_id}/activate
POST   /api/sites/{site_id}/standards/{source_id}/deactivate

Reference: PR-R1-04 plan
"""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import col, select

from app.api.dependencies import SessionDep
from app.models.enums import MetricName
from app.models.supporting import SiteMetricPreferences, SiteStandards
from app.models.workflow_a import ReferenceSource
from app.models.workflow_b import Site
from app.schemas.dashboard import (
    SiteMetricPreferencesResponse,
    SiteMetricPreferencesUpdate,
    SiteStandardResponse,
    SiteStandardsResponse,
)

router = APIRouter()


# ── Metric Preferences ────────────────────────────────────────────────────────


@router.get(
    "/sites/{site_id}/metric-preferences",
    response_model=SiteMetricPreferencesResponse,
    status_code=status.HTTP_200_OK,
)
async def get_metric_preferences(site_id: str, session: SessionDep):
    """
    Return metric preferences for a site.
    If no row exists, return defaults (empty list/dict).
    Returns 404 if site not found.
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found.",
        )

    prefs = session.exec(
        select(SiteMetricPreferences).where(
            col(SiteMetricPreferences.site_id) == site_id
        )
    ).first()

    if prefs:
        return SiteMetricPreferencesResponse(
            site_id=prefs.site_id,
            active_metrics=prefs.active_metrics or [],
            alert_threshold_overrides=prefs.alert_threshold_overrides or {},
        )

    return SiteMetricPreferencesResponse(
        site_id=site_id,
        active_metrics=[],
        alert_threshold_overrides={},
    )


@router.patch(
    "/sites/{site_id}/metric-preferences",
    response_model=SiteMetricPreferencesResponse,
    status_code=status.HTTP_200_OK,
)
async def update_metric_preferences(
    site_id: str,
    body: SiteMetricPreferencesUpdate,
    session: SessionDep,
):
    """
    Update metric preferences for a site.

    Validates:
    - Each metric in active_metrics is a valid MetricName enum value
    - Threshold overrides have numeric watch_max/watch_min/critical_max/critical_min fields
    - Threshold values fall within rulebook min_value/max_value bounds for that metric

    Returns 400 if validation fails, 404 if site not found.
    """
    from app.models.workflow_a import RulebookEntry

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found.",
        )

    # Validate active_metrics
    if body.active_metrics is not None:
        valid_metrics = {m.value for m in MetricName}
        for metric in body.active_metrics:
            if metric not in valid_metrics:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid metric name: {metric}. Valid: {sorted(valid_metrics)}",
                )

    # Validate threshold overrides against rulebook bounds
    if body.alert_threshold_overrides is not None:
        for metric_name, thresholds in body.alert_threshold_overrides.items():
            if metric_name not in {m.value for m in MetricName}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid metric in threshold overrides: {metric_name}",
                )

            # Fetch rulebook bounds for this metric
            rules = session.exec(
                select(RulebookEntry).where(
                    col(RulebookEntry.metric_name) == metric_name,
                    col(RulebookEntry.approval_status) == "approved",
                )
            ).all()

            if not rules:
                continue

            # Use the tightest bounds from all approved rules for this metric
            min_bound = min(r.min_value for r in rules if r.min_value is not None)
            max_bound = max(r.max_value for r in rules if r.max_value is not None)

            for key, value in thresholds.items():
                if not isinstance(value, (int, float)):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Threshold value for {metric_name}.{key} must be numeric",
                    )
                if key.endswith("_min") and value < min_bound:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Threshold {metric_name}.{key}={value} is below rulebook minimum {min_bound}",
                    )
                if key.endswith("_max") and value > max_bound:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Threshold {metric_name}.{key}={value} exceeds rulebook maximum {max_bound}",
                    )

    # Upsert preferences
    prefs = session.exec(
        select(SiteMetricPreferences).where(
            col(SiteMetricPreferences.site_id) == site_id
        )
    ).first()

    if prefs:
        if body.active_metrics is not None:
            prefs.active_metrics = body.active_metrics
        if body.alert_threshold_overrides is not None:
            prefs.alert_threshold_overrides = body.alert_threshold_overrides
        from datetime import datetime
        prefs.updated_at = datetime.utcnow()
    else:
        prefs = SiteMetricPreferences(
            site_id=site_id,
            active_metrics=body.active_metrics or [],
            alert_threshold_overrides=body.alert_threshold_overrides or {},
        )
        session.add(prefs)

    session.commit()
    session.refresh(prefs)

    return SiteMetricPreferencesResponse(
        site_id=prefs.site_id,
        active_metrics=prefs.active_metrics or [],
        alert_threshold_overrides=prefs.alert_threshold_overrides or {},
    )


# ── Site Standards ────────────────────────────────────────────────────────────


@router.get(
    "/sites/{site_id}/standards",
    response_model=SiteStandardsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_site_standards(site_id: str, session: SessionDep):
    """
    Return active standards for a site, with titles from reference_source.
    Returns 404 if site not found.
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found.",
        )

    rows = session.exec(
        select(SiteStandards, ReferenceSource.title).join(
            ReferenceSource,
            col(SiteStandards.reference_source_id) == col(ReferenceSource.id),
        ).where(
            col(SiteStandards.site_id) == site_id,
            col(SiteStandards.is_active),
        )
    ).all()

    standards = [
        SiteStandardResponse(
            source_id=row[0].reference_source_id,
            title=row[1],
            is_active=row[0].is_active,
        )
        for row in rows
    ]

    return SiteStandardsResponse(
        site_id=site_id,
        standards=standards,
    )


@router.post(
    "/sites/{site_id}/standards/{source_id}/activate",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def activate_standard(site_id: str, source_id: str, session: SessionDep):
    """
    Activate a standard for a site. Idempotent — no error if already active.
    Returns 404 if site or source not found.
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found.",
        )

    source = session.get(ReferenceSource, source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reference source {source_id} not found.",
        )

    existing = session.exec(
        select(SiteStandards).where(
            col(SiteStandards.site_id) == site_id,
            col(SiteStandards.reference_source_id) == source_id,
        )
    ).first()

    if existing:
        existing.is_active = True
    else:
        entry = SiteStandards(
            site_id=site_id,
            reference_source_id=source_id,
            is_active=True,
        )
        session.add(entry)

    session.commit()


@router.post(
    "/sites/{site_id}/standards/{source_id}/deactivate",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deactivate_standard(site_id: str, source_id: str, session: SessionDep):
    """
    Deactivate a standard for a site. Idempotent — no error if already inactive.
    Returns 404 if site not found (source check is lenient).
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found.",
        )

    existing = session.exec(
        select(SiteStandards).where(
            col(SiteStandards.site_id) == site_id,
            col(SiteStandards.reference_source_id) == source_id,
        )
    ).first()

    if existing:
        existing.is_active = False
        session.add(existing)
        session.commit()
