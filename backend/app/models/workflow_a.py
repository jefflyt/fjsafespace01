"""
backend/app/models/workflow_a.py

SQLModel table definitions for Workflow A — Reference Vault → Rulebook governance.

IMPORTANT: These tables are READ-ONLY from all dashboard services.
The app DB role (`DATABASE_URL`) has SELECT-only permission on these tables.
Only the admin console (using `ADMIN_DATABASE_URL`) may write to them.

Reference: TDD §3.3
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import (
    ConfidenceLevel,
    MetricName,
    Priority,
    SourceCurrency,
)


# ── ReferenceSource ───────────────────────────────────────────────────────────


class ReferenceSource(SQLModel, table=True):
    __tablename__ = "reference_source"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str
    publisher: str
    # standard | guideline | whitepaper | vendor
    source_type: str
    jurisdiction: str
    url: Optional[str] = None
    file_storage_key: Optional[str] = None
    checksum: Optional[str] = None
    version_label: Optional[str] = None
    published_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    # active | superseded | retired
    status: str
    source_currency_status: SourceCurrency
    source_completeness_status: Optional[str] = None
    last_verified_at: Optional[datetime] = None

    citation_units: list["CitationUnit"] = Relationship(back_populates="source")


# ── CitationUnit ──────────────────────────────────────────────────────────────


class CitationUnit(SQLModel, table=True):
    __tablename__ = "citation_unit"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    source_id: str = Field(foreign_key="reference_source.id")
    page_or_section: Optional[str] = None
    exact_excerpt: str
    # JSON-serialised string[]
    metric_tags: str
    # JSON-serialised string[]
    condition_tags: str
    extracted_threshold_value: Optional[float] = None
    extracted_unit: Optional[str] = None
    extraction_confidence: Optional[float] = None
    extractor_version: Optional[str] = None
    needs_review: bool = Field(default=True)

    source: ReferenceSource = Relationship(back_populates="citation_units")


# ── RulebookEntry ─────────────────────────────────────────────────────────────


class RulebookEntry(SQLModel, table=True):
    """
    The runtime source of truth for IAQ thresholds and certification logic.

    Dashboard services query this table SELECT-only.
    The Wellness Index weight (index_weight_percent) is pulled from here
    to ensure the Rulebook remains the strictly version-controlled anchor base.
    """

    __tablename__ = "rulebook_entry"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    metric_name: MetricName
    # range | upper_bound | lower_bound
    threshold_type: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit: str
    # office | industrial | school | residential | general
    context_scope: str
    interpretation_template: str
    business_impact_template: str
    recommendation_template: str
    priority_logic: Priority
    # Wellness Index weight % for this metric (e.g. 25.0 for CO2)
    # Sourced from documentation anchor — never hardcoded in application logic
    index_weight_percent: Optional[float] = None
    confidence_level: ConfidenceLevel
    rule_version: str
    effective_from: datetime
    effective_to: Optional[datetime] = None
    # draft | approved | superseded
    approval_status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    # Comma-separated citation unit IDs linked to this rule
    citation_unit_ids: str
