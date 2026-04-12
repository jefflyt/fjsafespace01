"""
backend/app/api/routers/rulebook.py

Rulebook routes — READ-ONLY.

GET /api/rulebook/rules        (optional query params: metricName, contextScope, approvalStatus)
GET /api/rulebook/rules/{id}   (returns rule + citationUnits[])
GET /api/rulebook/sources      (returns ReferenceSource[] with sourceCurrencyStatus)

IMPORTANT: PUT / POST / DELETE on any rulebook route must return 405 Method Not Allowed.
This is enforced by the integration test "Rulebook read-only" (TDD §8.2).

Reference: TDD §4.6
"""

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import SessionDep
from app.models.enums import MetricName

router = APIRouter()


@router.get("/rulebook/rules", status_code=status.HTTP_200_OK)
async def list_rules(
    session: SessionDep,
    metric_name: MetricName | None = None,
    context_scope: str | None = None,
    approval_status: str | None = None,
):
    """Returns all RulebookEntry records matching optional filters."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/rulebook/rules/{rule_id}", status_code=status.HTTP_200_OK)
async def get_rule(rule_id: str, session: SessionDep):
    """Returns a single RulebookEntry with its related citationUnits[]."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/rulebook/sources", status_code=status.HTTP_200_OK)
async def list_sources(session: SessionDep):
    """Returns all ReferenceSource records including sourceCurrencyStatus."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")
