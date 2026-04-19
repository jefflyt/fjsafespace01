"""
backend/app/api/routers/rulebook.py

Rulebook routes — READ-ONLY.

GET /api/rulebook/rules        (optional query params: metric_name, context_scope, approval_status)
GET /api/rulebook/rules/{id}   (returns rule + citationUnits[])
GET /api/rulebook/sources      (returns ReferenceSource[] with sourceCurrencyStatus)

IMPORTANT: PUT / POST / DELETE on any rulebook route must return 405 Method Not Allowed.
This is enforced by the integration test "Rulebook read-only" (TDD §8.2).

Reference: TDD §4.6
"""

from sqlmodel import Session, col, select

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import SessionDep
from app.models.enums import MetricName
from app.models.workflow_a import CitationUnit, ReferenceSource, RulebookEntry

router = APIRouter()


@router.get("/rulebook/rules", status_code=status.HTTP_200_OK)
def list_rules(
    session: SessionDep,
    metric_name: MetricName | None = None,
    context_scope: str | None = None,
    approval_status: str | None = "approved",
    include_superseded: bool = False,
):
    """Returns all RulebookEntry records matching optional filters.

    By default only returns approved entries. Set approval_status=None to
    include drafts. Set include_superseded=True to also return superseded entries.
    """
    query = select(RulebookEntry)

    if metric_name is not None:
        query = query.where(col(RulebookEntry.metric_name) == metric_name.value)
    if context_scope is not None:
        query = query.where(col(RulebookEntry.context_scope) == context_scope)
    if approval_status is not None:
        query = query.where(col(RulebookEntry.approval_status) == approval_status)
    if include_superseded:
        # Also return superseded entries alongside the filtered results
        query = query.where(
            col(RulebookEntry.approval_status).in_(["approved", "superseded"])
            if approval_status is None or approval_status == "approved"
            else col(RulebookEntry.approval_status) == approval_status
        )

    results = session.exec(query).all()
    return [_rule_to_dict(rule, session) for rule in results]


@router.get("/rulebook/rules/{rule_id}", status_code=status.HTTP_200_OK)
def get_rule(rule_id: str, session: SessionDep):
    """Returns a single RulebookEntry with its related citationUnits[]."""
    rule = session.get(RulebookEntry, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    citations = _get_citations_for_rule(session, rule)
    return {**_rule_to_dict(rule, session), "citation_units": citations}


@router.get("/rulebook/sources", status_code=status.HTTP_200_OK)
def list_sources(session: SessionDep):
    """Returns all ReferenceSource records including sourceCurrencyStatus."""
    results = session.exec(select(ReferenceSource)).all()
    return [_source_to_dict(s) for s in results]


# ── Helper functions ─────────────────────────────────────────────────────────


def _rule_to_dict(rule: RulebookEntry, session: Session) -> dict:
    """Convert a RulebookEntry to a serializable dict."""
    return {
        "id": rule.id,
        "metric_name": rule.metric_name.value,
        "threshold_type": rule.threshold_type,
        "min_value": rule.min_value,
        "max_value": rule.max_value,
        "unit": rule.unit,
        "context_scope": rule.context_scope,
        "interpretation_template": rule.interpretation_template,
        "business_impact_template": rule.business_impact_template,
        "recommendation_template": rule.recommendation_template,
        "priority_logic": rule.priority_logic.value,
        "index_weight_percent": rule.index_weight_percent,
        "confidence_level": rule.confidence_level.value,
        "rule_version": rule.rule_version,
        "effective_from": rule.effective_from.isoformat() if rule.effective_from else None,
        "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
        "approval_status": rule.approval_status,
        "approved_by": rule.approved_by,
        "approved_at": rule.approved_at.isoformat() if rule.approved_at else None,
        "citation_unit_ids": rule.citation_unit_ids,
    }


def _source_to_dict(source: ReferenceSource) -> dict:
    """Convert a ReferenceSource to a serializable dict."""
    return {
        "id": source.id,
        "title": source.title,
        "publisher": source.publisher,
        "source_type": source.source_type,
        "jurisdiction": source.jurisdiction,
        "url": source.url,
        "file_storage_key": source.file_storage_key,
        "checksum": source.checksum,
        "version_label": source.version_label,
        "published_date": source.published_date.isoformat() if source.published_date else None,
        "effective_date": source.effective_date.isoformat() if source.effective_date else None,
        "ingested_at": source.ingested_at.isoformat() if source.ingested_at else None,
        "status": source.status,
        "source_currency_status": source.source_currency_status.value,
        "source_completeness_status": source.source_completeness_status,
        "last_verified_at": source.last_verified_at.isoformat() if source.last_verified_at else None,
    }


def _citation_to_dict(citation: CitationUnit) -> dict:
    """Convert a CitationUnit to a serializable dict."""
    return {
        "id": citation.id,
        "source_id": citation.source_id,
        "page_or_section": citation.page_or_section,
        "exact_excerpt": citation.exact_excerpt,
        "metric_tags": citation.metric_tags,
        "condition_tags": citation.condition_tags,
        "extracted_threshold_value": citation.extracted_threshold_value,
        "extracted_unit": citation.extracted_unit,
        "extraction_confidence": citation.extraction_confidence,
        "extractor_version": citation.extractor_version,
        "needs_review": citation.needs_review,
    }


def _get_citations_for_rule(session: Session, rule: RulebookEntry) -> list[dict]:
    """Fetch citation units linked to a rule via citation_unit_ids (comma-separated)."""
    if not rule.citation_unit_ids:
        return []
    ids = [cid.strip() for cid in rule.citation_unit_ids.split(",") if cid.strip()]
    citations = session.exec(select(CitationUnit).where(col(CitationUnit.id).in_(ids))).all()
    return [_citation_to_dict(c) for c in citations]
