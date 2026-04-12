"""
backend/app/models/enums.py

All shared enums for FJDashboard.  Import from here across the codebase
to avoid circular definitions.  Any new enum must be reviewed against the
TDD §3.1 enum block before adding.
"""

import enum


class ParseStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class ParseOutcome(str, enum.Enum):
    PASS = "PASS"
    PASS_WITH_WARNINGS = "PASS_WITH_WARNINGS"
    FAIL = "FAIL"


class MetricName(str, enum.Enum):
    co2_ppm = "co2_ppm"
    pm25_ugm3 = "pm25_ugm3"
    tvoc_ppb = "tvoc_ppb"
    temperature_c = "temperature_c"
    humidity_rh = "humidity_rh"


class ThresholdBand(str, enum.Enum):
    GOOD = "GOOD"
    WATCH = "WATCH"
    CRITICAL = "CRITICAL"


class ConfidenceLevel(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class BenchmarkLane(str, enum.Enum):
    FJ_SAFESPACE = "FJ_SAFESPACE"


class ReviewerStatus(str, enum.Enum):
    DRAFT_GENERATED = "DRAFT_GENERATED"
    IN_REVIEW = "IN_REVIEW"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    APPROVED = "APPROVED"
    EXPORTED = "EXPORTED"


class ReportType(str, enum.Enum):
    """
    Determines report framing and PDF template selection only.
    Both types follow the identical single-scan upload → findings → QA pipeline.
    ASSESSMENT      → current IAQ state template
    INTERVENTION_IMPACT → post-change contextual framing template
    """

    ASSESSMENT = "ASSESSMENT"
    INTERVENTION_IMPACT = "INTERVENTION_IMPACT"


class SourceCurrency(str, enum.Enum):
    """
    Source currency status for each citation unit / rulebook entry.
    Rules derived from PARTIAL_EXTRACT or VERSION_UNVERIFIED are advisory only
    and cannot be used for certification decisions (PSD §7, PRD §25).
    """

    CURRENT_VERIFIED = "CURRENT_VERIFIED"
    PARTIAL_EXTRACT = "PARTIAL_EXTRACT"
    VERSION_UNVERIFIED = "VERSION_UNVERIFIED"
    SUPERSEDED = "SUPERSEDED"


class Priority(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class CertificationOutcome(str, enum.Enum):
    """
    Never null — service returns INSUFFICIENT_EVIDENCE when no applicable
    rule set exists rather than null or a default pass value (TDD §4.2, PSD §5.1).
    """

    HEALTHY_WORKPLACE_CERTIFIED = "HEALTHY_WORKPLACE_CERTIFIED"
    HEALTHY_SPACE_VERIFIED = "HEALTHY_SPACE_VERIFIED"
    IMPROVEMENT_RECOMMENDED = "IMPROVEMENT_RECOMMENDED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
