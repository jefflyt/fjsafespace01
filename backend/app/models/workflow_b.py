"""
backend/app/models/workflow_b.py

SQLModel table definitions for Workflow B — Scan → Report operations.
These are the tables that the dashboard reads from and writes to.

Reference: TDD §3.2
"""

import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import Column, Index
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import (
    BenchmarkLane,
    CertificationOutcome,
    ConfidenceLevel,
    MetricName,
    ParseOutcome,
    ParseStatus,
    ReportType,
    ReviewerStatus,
    SourceCurrency,
    ThresholdBand,
)


# ── Site ─────────────────────────────────────────────────────────────────────


class Site(SQLModel, table=True):
    __tablename__ = "site"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    # null for Phase 1/2; required Phase 3 (enforced by application logic, not DB)
    tenant_id: Optional[str] = Field(default=None, foreign_key="tenant.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # R1-03: per-site context and standard selection
    context_scope: Optional[str] = Field(default="general")
    standard_ids: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(ARRAY(sa.Text())),
    )

    readings: list["Reading"] = Relationship(back_populates="site")
    uploads: list["Upload"] = Relationship(back_populates="site")
    reports: list["Report"] = Relationship(back_populates="site")


# ── Upload ────────────────────────────────────────────────────────────────────


class Upload(SQLModel, table=True):
    __tablename__ = "upload"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    site_id: str = Field(foreign_key="site.id")
    file_name: str
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    parse_status: ParseStatus = Field(default=ParseStatus.PENDING)
    parse_outcome: Optional[ParseOutcome] = None
    report_type: Optional[ReportType] = None
    rule_version_used: Optional[str] = None
    # JSON-serialised string[]
    warnings: Optional[str] = None
    # R1-03: scan tracking
    scan_type: Optional[str] = Field(default="adhoc")
    standards_evaluated: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(ARRAY(sa.Text())),
    )

    site: Site = Relationship(back_populates="uploads")
    readings: list["Reading"] = Relationship(back_populates="upload")
    findings: list["Finding"] = Relationship(back_populates="upload")
    report: Optional["Report"] = Relationship(back_populates="upload")


# ── Reading ───────────────────────────────────────────────────────────────────


class Reading(SQLModel, table=True):
    __tablename__ = "reading"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    upload_id: str = Field(foreign_key="upload.id")
    site_id: str = Field(foreign_key="site.id")
    device_id: str
    zone_name: str
    reading_timestamp: datetime
    metric_name: MetricName
    metric_value: float
    metric_unit: str
    is_outlier: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    upload: Upload = Relationship(back_populates="readings")
    site: Site = Relationship(back_populates="readings")


# ── Finding ───────────────────────────────────────────────────────────────────


class Finding(SQLModel, table=True):
    """
    A Finding is the output of rule evaluation for a single metric reading.

    Governance constraints (enforced in service layer):
    - citation_unit_ids must NOT be empty for certification-impact findings (QA-G5)
    - source_currency_status NOT NULL (TDD §3.5)
    - rule_id + rule_version required; absence blocks report approval (D1 requirement)
    """

    __tablename__ = "finding"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    upload_id: str = Field(foreign_key="upload.id")
    site_id: str = Field(foreign_key="site.id")
    zone_name: str
    metric_name: MetricName
    metric_value: float
    threshold_band: ThresholdBand
    interpretation_text: str
    workforce_impact_text: str
    recommended_action: str
    rule_id: str
    rule_version: str
    # JSON-serialised string[] — absence triggers QA-G5
    citation_unit_ids: str
    confidence_level: ConfidenceLevel
    # NOT NULL enforced — must always be present (TDD §3.5)
    source_currency_status: SourceCurrency
    benchmark_lane: BenchmarkLane
    created_at: datetime = Field(default_factory=datetime.utcnow)

    __table_args__ = (
        # PR 6.1: Indexes for aggregated cross-site queries
        Index("ix_finding_site_id", "site_id"),
        Index("ix_finding_created_at", "created_at"),
        Index("ix_finding_rule_version", "rule_version"),
        Index("ix_finding_site_created", "site_id", "created_at"),
    )

    upload: Upload = Relationship(back_populates="findings")


# ── Report ────────────────────────────────────────────────────────────────────


class Report(SQLModel, table=True):
    """
    A Report is generated from a single Upload's Findings.

    report_type determines which PDF template is rendered:
      ASSESSMENT          → standard current-state IAQ template
      INTERVENTION_IMPACT → post-change contextual framing template

    Both types follow the same upload → findings → QA → generation pipeline.
    report_type cannot be changed after generation.
    """

    __tablename__ = "report"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    report_type: ReportType = Field(default=ReportType.ASSESSMENT)
    upload_id: str = Field(foreign_key="upload.id", unique=True)
    site_id: str = Field(foreign_key="site.id")
    report_version: int = Field(default=1)
    rule_version_used: str
    # JSON-serialised string[]
    citation_ids_used: str
    reviewer_name: Optional[str] = None
    reviewer_status: ReviewerStatus = Field(default=ReviewerStatus.DRAFT_GENERATED)
    reviewer_approved_at: Optional[datetime] = None
    # QA checklist — JSON dict of gate_id -> bool
    qa_checks: str = Field(default="{}")
    # Data quality statement (free text)
    data_quality_statement: Optional[str] = None
    # Certification outcome (never null after evaluation)
    certification_outcome: Optional[CertificationOutcome] = None
    # Immutable JSON snapshot of the full report context at approval time.
    # Used for on-demand PDF generation and dashboard rendering.
    report_snapshot: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    __table_args__ = (
        # PR 6.1: Indexes for aggregated reporting queries
        Index("ix_report_site_id", "site_id"),
        Index("ix_report_generated_at", "generated_at"),
    )

    upload: Upload = Relationship(back_populates="report")
    site: Site = Relationship(back_populates="reports")
