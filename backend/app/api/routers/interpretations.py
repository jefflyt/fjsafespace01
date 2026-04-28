"""
backend/app/api/routers/interpretations.py

Human-readable interpretation lookup routes.

GET /api/interpretations/{metric_name}/{threshold_band}

Maps threshold bands to plain-language interpretation, business impact,
and recommendation templates from the rulebook.

Reference: PR-R1-04 plan
"""

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import col, select

from app.api.dependencies import SessionDep
from app.models.enums import MetricName, ThresholdBand
from app.models.workflow_a import RulebookEntry
from app.schemas.dashboard import InterpretationResponse

router = APIRouter()


@router.get(
    "/interpretations/{metric_name}/{threshold_band}",
    response_model=InterpretationResponse,
    status_code=status.HTTP_200_OK,
)
async def get_interpretation(
    metric_name: str,
    threshold_band: str,
    session: SessionDep,
    context_scope: str | None = Query(
        default="general",
        description="Context scope for the interpretation (default: general)",
    ),
):
    """
    Return human-readable interpretation for a metric/threshold combination.

    Queries rulebook_entry for the metric, maps threshold_band to
    interpretation_template, business_impact_template, recommendation_template.

    Returns 404 if no rule found for the metric.
    """
    # Validate metric_name
    try:
        metric_enum = MetricName(metric_name)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No rule found for metric: {metric_name}",
        )

    # Validate threshold_band
    try:
        ThresholdBand(threshold_band)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid threshold_band: {threshold_band}. Valid: {[b.value for b in ThresholdBand]}",
        )

    # Find a rulebook entry for this metric and context scope
    scope = context_scope or "general"
    entry = session.exec(
        select(RulebookEntry).where(
            col(RulebookEntry.metric_name) == metric_enum.value,
            col(RulebookEntry.context_scope) == scope,
            col(RulebookEntry.approval_status) == "approved",
        )
    ).first()

    # Fall back to "general" scope if specific scope not found
    if not entry and scope != "general":
        entry = session.exec(
            select(RulebookEntry).where(
                col(RulebookEntry.metric_name) == metric_enum.value,
                col(RulebookEntry.context_scope) == "general",
                col(RulebookEntry.approval_status) == "approved",
            )
        ).first()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No rule found for metric {metric_name} in context '{scope}'.",
        )

    return InterpretationResponse(
        metric_name=metric_name,
        threshold_band=threshold_band,
        interpretation=entry.interpretation_template,
        business_impact=entry.business_impact_template,
        recommendation=entry.recommendation_template,
        context_scope=scope,
    )
