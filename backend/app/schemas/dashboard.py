"""
backend/app/schemas/dashboard.py

Pydantic response schemas for the Executive Dashboard API.

Reference: PLAN docs/plans/epics/pr6-executive-dashboard/PLAN.md § PR 6.2
"""

from typing import Optional

from pydantic import BaseModel


class LeaderboardRow(BaseModel):
    """A single site's row in the executive leaderboard."""
    site_id: str
    site_name: str
    wellness_index_score: float
    certification_outcome: str
    last_scan_date: Optional[str] = None
    finding_count: int


class TopRisk(BaseModel):
    """A high-priority risk displayed in the Top 3 Risks panel."""
    site_name: str
    site_id: str
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
