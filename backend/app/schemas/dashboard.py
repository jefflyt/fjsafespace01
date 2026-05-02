"""
backend/app/schemas/dashboard.py

Pydantic response schemas for the Executive Dashboard API.

Reference: PLAN docs/plans/epics/pr6-executive-dashboard/PLAN.md § PR 6.2
"""

from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator

# Accept UUID objects from SQLAlchemy and auto-convert to string
UUIDStr = Annotated[str, BeforeValidator(str)]


class LeaderboardRow(BaseModel):
    """A single site's row in the executive leaderboard."""
    site_id: UUIDStr
    site_name: str
    wellness_index_score: float
    certification_outcome: str
    last_scan_date: Optional[str] = None
    finding_count: int


class TopRisk(BaseModel):
    """A high-priority risk displayed in the Top 3 Risks panel."""
    site_name: str
    site_id: UUIDStr
    metric_name: str
    threshold_band: str
    interpretation_text: str
    recommended_action: str
    finding_timestamp: str
    is_advisory: bool


class TopAction(BaseModel):
    """A recommended action derived from critical findings."""
    site_name: str
    metric_name: str
    recommended_action: str
    priority: str


class SpaceHealthRating(BaseModel):
    """Portfolio-level health summary."""
    total_sites: int
    certified: int
    verified: int
    improvement_recommended: int
    insufficient_evidence: int
    average_wellness_index: float


class ExecutiveDashboardResponse(BaseModel):
    """Full response for GET /api/dashboard/executive."""
    leaderboard: list[LeaderboardRow]
    top_risks: list[TopRisk]
    top_actions: list[TopAction]
    health_ratings: SpaceHealthRating


# ── R1-04: Site Metric Preferences ──────────────────────────────────────────

class SiteMetricPreferencesResponse(BaseModel):
    """GET /api/sites/{site_id}/metric-preferences response."""
    site_id: UUIDStr
    active_metrics: list[str]
    alert_threshold_overrides: dict[str, dict]


class SiteMetricPreferencesUpdate(BaseModel):
    """PATCH /api/sites/{site_id}/metric-preferences body."""
    active_metrics: list[str] | None = None
    alert_threshold_overrides: dict[str, dict] | None = None


# ── R1-04: Site Standards ───────────────────────────────────────────────────

class SiteStandardResponse(BaseModel):
    """A single standard for a site."""
    source_id: UUIDStr
    title: str
    is_active: bool


class SiteStandardsResponse(BaseModel):
    """GET /api/sites/{site_id}/standards response."""
    standards: list[SiteStandardResponse]


# ── R1-04: Interpretations ──────────────────────────────────────────────────

class InterpretationResponse(BaseModel):
    """GET /api/interpretations/{metric_name}/{threshold_band} response."""
    metric_name: str
    threshold_band: str
    interpretation: str
    business_impact: str
    recommendation: str
    context_scope: str
