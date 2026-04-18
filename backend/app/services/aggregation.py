"""
backend/app/services/aggregation.py

Dashboard Aggregation Service — PR 6.1

Provides cross-site aggregated data for the Executive Dashboard:
- Per-site Wellness Index calculation
- Top 3 risks across sites
- Leaderboard rows sorted by wellness_index_score DESC

The Wellness Index uses weights from RulebookEntry.index_weight_percent
(never hardcoded) via the existing wellness_index calculator.

Reference: PLAN docs/plans/epics/pr6-executive-dashboard/PLAN.md § PR 6.1
"""

from sqlmodel import Session, col, select

from app.models.enums import CertificationOutcome, SourceCurrency, ThresholdBand
from app.models.workflow_a import RulebookEntry
from app.models.workflow_b import Finding, Report, Site
from app.skills.iaq_rule_governor.wellness_index import (
    calculate_wellness_index,
    derive_certification_outcome,
)


def _get_rulebook_weights(session: Session, rule_version: str) -> dict[str, float]:
    """
    Fetch index_weight_percent for each metric from the active rulebook version.
    Returns {metric_name: weight_percent} for metrics that have a weight defined.
    """
    entries = session.exec(
        select(RulebookEntry)
        .where(
            col(RulebookEntry.rule_version) == rule_version,
            col(RulebookEntry.index_weight_percent).isnot(None),
            col(RulebookEntry.approval_status) == "approved",
        )
    ).all()
    return {entry.metric_name.value: entry.index_weight_percent for entry in entries}


def _get_site_findings(session: Session, site_id: str) -> list[dict]:
    """
    Fetch all findings for a site and return as list of dicts
    compatible with calculate_wellness_index input.
    """
    findings = session.exec(
        select(Finding).where(col(Finding.site_id) == site_id)
    ).all()
    return [
        {
            "metric_name": f.metric_name.value,
            "threshold_band": f.threshold_band.value,
        }
        for f in findings
    ]


def _get_latest_report_for_site(
    session: Session, site_id: str
) -> Report | None:
    """Get the most recent report for a site."""
    reports = session.exec(
        select(Report)
        .where(col(Report.site_id) == site_id)
        .order_by(col(Report.generated_at).desc())
    ).all()
    return reports[0] if reports else None


def calculate_site_wellness_index(
    session: Session, site_id: str
) -> tuple[float, CertificationOutcome]:
    """
    Calculate the Wellness Index score for a single site.

    Returns:
        (wellness_index_score, certification_outcome)
        Returns (0.0, INSUFFICIENT_EVIDENCE) if no findings or weights exist.
    """
    report = _get_latest_report_for_site(session, site_id)
    rule_version = report.rule_version_used if report else None

    if not rule_version:
        return 0.0, CertificationOutcome.INSUFFICIENT_EVIDENCE

    weights = _get_rulebook_weights(session, rule_version)
    findings = _get_site_findings(session, site_id)

    if not weights or not findings:
        return 0.0, CertificationOutcome.INSUFFICIENT_EVIDENCE

    score = calculate_wellness_index(findings, weights)
    outcome = derive_certification_outcome(score)
    return score, outcome


def get_top_3_risks(session: Session, site_ids: list[str] | None = None) -> list[dict]:
    """
    Get the top 3 highest-priority risks across the specified sites.

    Priority is determined by:
    1. CRITICAL threshold_band findings first
    2. Within CRITICAL, prefer non-CURRENT_VERIFIED sources (advisory risks)
    3. Most recent findings first

    If site_ids is None, considers all sites.

    Returns:
        List of dicts with keys: site_name, metric_name, threshold_band,
        interpretation_text, recommended_action, finding_timestamp, is_advisory
    """
    query = select(Finding, Site.name).join(
        Site, col(Finding.site_id) == col(Site.id)
    ).where(
        col(Finding.threshold_band) == ThresholdBand.CRITICAL
    ).order_by(
        col(Finding.created_at).desc()
    )

    if site_ids:
        query = query.where(col(Finding.site_id).in_(site_ids))

    # Limit to a larger set first, then we pick top 3 after advisory sorting
    results = session.exec(query.limit(50)).all()

    risks = []
    for finding, site_name in results:
        risks.append({
            "site_name": site_name,
            "site_id": finding.site_id,
            "metric_name": finding.metric_name.value,
            "threshold_band": finding.threshold_band.value,
            "interpretation_text": finding.interpretation_text,
            "recommended_action": finding.recommended_action,
            "finding_timestamp": finding.created_at.isoformat(),
            "is_advisory": finding.source_currency_status != SourceCurrency.CURRENT_VERIFIED,
        })

    # Sort: non-advisory (certification-impact) risks first, then by timestamp desc
    critical_risks = [r for r in risks if not r["is_advisory"]]
    advisory_risks = [r for r in risks if r["is_advisory"]]
    return (critical_risks + advisory_risks)[:3]


def get_top_3_actions(session: Session, site_ids: list[str] | None = None) -> list[dict]:
    """
    Get the top 3 recommended actions from CRITICAL findings.

    Returns:
        List of dicts with keys: site_name, metric_name, recommended_action, priority
    """
    risks = get_top_3_risks(session, site_ids)
    return [
        {
            "site_name": r["site_name"],
            "metric_name": r["metric_name"],
            "recommended_action": r["recommended_action"],
            "priority": "HIGH",
        }
        for r in risks
    ]


def get_leaderboard(
    session: Session, site_ids: list[str] | None = None
) -> list[dict]:
    """
    Build a cross-site leaderboard sorted by wellness_index_score DESC.

    Returns:
        List of dicts with keys: site_id, site_name, wellness_index_score,
        certification_outcome, last_scan_date, finding_count
    """
    sites = session.exec(select(Site)).all()
    if site_ids:
        sites = [s for s in sites if s.id in site_ids]

    rows = []
    for site in sites:
        score, outcome = calculate_site_wellness_index(session, site.id)

        # Get last scan date from most recent finding
        latest_finding = session.exec(
            select(Finding)
            .where(col(Finding.site_id) == site.id)
            .order_by(col(Finding.created_at).desc())
            .limit(1)
        ).first()

        finding_count = session.exec(
            select(Finding).where(col(Finding.site_id) == site.id)
        ).all()

        rows.append({
            "site_id": site.id,
            "site_name": site.name,
            "wellness_index_score": score,
            "certification_outcome": outcome.value,
            "last_scan_date": latest_finding.created_at.isoformat() if latest_finding else None,
            "finding_count": len(finding_count),
        })

    # Sort by wellness_index_score descending
    rows.sort(key=lambda r: r["wellness_index_score"], reverse=True)
    return rows


def get_executive_dashboard(
    session: Session, site_ids: list[str] | None = None
) -> dict:
    """
    Aggregate all data needed for the executive dashboard in a single call.

    Returns:
        Dict with keys: leaderboard, top_risks, top_actions, health_ratings
    """
    leaderboard = get_leaderboard(session, site_ids)
    top_risks = get_top_3_risks(session, site_ids)
    top_actions = get_top_3_actions(session, site_ids)

    # Health ratings summary
    total_sites = len(leaderboard)
    certified = sum(
        1 for r in leaderboard
        if r["certification_outcome"] == CertificationOutcome.HEALTHY_WORKPLACE_CERTIFIED.value
    )
    verified = sum(
        1 for r in leaderboard
        if r["certification_outcome"] == CertificationOutcome.HEALTHY_SPACE_VERIFIED.value
    )
    improvement = sum(
        1 for r in leaderboard
        if r["certification_outcome"] == CertificationOutcome.IMPROVEMENT_RECOMMENDED.value
    )
    insufficient = sum(
        1 for r in leaderboard
        if r["certification_outcome"] == CertificationOutcome.INSUFFICIENT_EVIDENCE.value
    )

    avg_score = (
        round(sum(r["wellness_index_score"] for r in leaderboard) / total_sites, 2)
        if total_sites > 0
        else 0.0
    )

    return {
        "leaderboard": leaderboard,
        "top_risks": top_risks,
        "top_actions": top_actions,
        "health_ratings": {
            "total_sites": total_sites,
            "certified": certified,
            "verified": verified,
            "improvement_recommended": improvement,
            "insufficient_evidence": insufficient,
            "average_wellness_index": avg_score,
        },
    }
