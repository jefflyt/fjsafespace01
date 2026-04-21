"""
backend/tests/unit/test_db_rule_service.py

Unit tests for the DB-backed rule service.
Tests the RulebookEntry -> RuleDefinition conversion and fetch logic.

Band inference heuristic (_infer_band):
- min_value=0, max_value finite -> GOOD
- min_value>0, both finite -> WATCH
- min_value=None or max_value=None -> CRITICAL
"""

from datetime import datetime, timezone

from sqlmodel import Session, col, select

from app.services.db_rule_service import (
    entry_to_rule_definition,
    fetch_rules_from_db,
    get_latest_approved_version,
    extract_band_from_rule_id,
)
from app.models.workflow_a import RulebookEntry, CitationUnit
from app.models.enums import MetricName, ThresholdBand, ConfidenceLevel


# ── Band extraction from rule_id (utility function) ───────────────────────────


def test_extract_band_from_rule_id_good():
    assert extract_band_from_rule_id("R-CO2-GOOD") == ThresholdBand.GOOD
    assert extract_band_from_rule_id("R-PM25-GOOD") == ThresholdBand.GOOD


def test_extract_band_from_rule_id_watch():
    assert extract_band_from_rule_id("R-CO2-WATCH") == ThresholdBand.WATCH
    assert extract_band_from_rule_id("R-TEMP-WATCH-HIGH") == ThresholdBand.WATCH
    assert extract_band_from_rule_id("R-HUM-WATCH-LOW") == ThresholdBand.WATCH


def test_extract_band_from_rule_id_critical():
    assert extract_band_from_rule_id("R-CO2-CRITICAL") == ThresholdBand.CRITICAL
    assert extract_band_from_rule_id("R-TEMP-CRITICAL-HIGH") == ThresholdBand.CRITICAL
    assert extract_band_from_rule_id("R-HUM-CRITICAL-LOW") == ThresholdBand.CRITICAL


def test_extract_band_from_rule_id_invalid():
    assert extract_band_from_rule_id("R") is None
    assert extract_band_from_rule_id("INVALID") is None


# ── Entry to RuleDefinition conversion ────────────────────────────────────────


def test_entry_to_rule_definition_good_band(db_session):
    """A RulebookEntry with GOOD band (min=0) converts correctly."""
    entry = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="range",
        min_value=0.0,
        max_value=800.0,
        unit="ppm",
        context_scope="general",
        interpretation_template="CO2 is good.",
        business_impact_template="Normal cognition.",
        recommendation_template="No action.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-CO2-001",
        index_weight_percent=25.0,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    rule = entry_to_rule_definition(entry)

    assert rule.metric_name == MetricName.co2_ppm
    assert rule.band == ThresholdBand.GOOD
    assert rule.min_value == 0.0
    assert rule.max_value == 800.0
    assert rule.rule_id == "R-CO2-GOOD"
    assert rule.citation_unit_ids == ["CIT-CO2-001"]


def test_entry_to_rule_definition_watch_band(db_session):
    """A WATCH band entry (min>0, finite max) converts correctly."""
    entry = RulebookEntry(
        metric_name=MetricName.pm25_ugm3,
        threshold_type="range",
        min_value=12.0,
        max_value=35.0,
        unit="μg/m³",
        context_scope="general",
        interpretation_template="PM2.5 is elevated.",
        business_impact_template="Sensitive individuals may experience irritation.",
        recommendation_template="Check air filtration.",
        priority_logic="P2",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-PM25-002",
        index_weight_percent=25.0,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    rule = entry_to_rule_definition(entry)

    assert rule.band == ThresholdBand.WATCH
    assert rule.rule_id == "R-PM25-WATCH"


def test_entry_to_rule_definition_critical_high(db_session):
    """A CRITICAL band entry with no max_value converts correctly."""
    entry = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
        min_value=1200.0,
        max_value=None,
        unit="ppm",
        context_scope="general",
        interpretation_template="CO2 critical.",
        business_impact_template="Impairment likely.",
        recommendation_template="Emergency ventilation.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-CO2-003",
        index_weight_percent=25.0,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    rule = entry_to_rule_definition(entry)

    assert rule.band == ThresholdBand.CRITICAL
    assert rule.max_value is None
    assert rule.rule_id == "R-CO2-CRITICAL"


def test_entry_to_rule_definition_multiple_citations(db_session):
    """A RulebookEntry with comma-separated citation_unit_ids parses correctly."""
    entry = RulebookEntry(
        metric_name=MetricName.pm25_ugm3,
        threshold_type="range",
        min_value=0.0,
        max_value=12.0,
        unit="μg/m³",
        context_scope="general",
        interpretation_template="PM2.5 is good.",
        business_impact_template="Low health risk.",
        recommendation_template="No action.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-ASH-001, CIT-SS554-002",
        index_weight_percent=25.0,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    rule = entry_to_rule_definition(entry)

    assert rule.citation_unit_ids == ["CIT-ASH-001", "CIT-SS554-002"]
    assert rule.band == ThresholdBand.GOOD


def test_entry_to_rule_definition_critical_low(db_session):
    """A CRITICAL band entry with no min_value converts correctly."""
    entry = RulebookEntry(
        metric_name=MetricName.temperature_c,
        threshold_type="lower_bound",
        min_value=None,
        max_value=10.0,
        unit="°C",
        context_scope="general",
        interpretation_template="Temperature critically low.",
        business_impact_template="Cold stress risk.",
        recommendation_template="Emergency heating.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-ASHRAE-003",
        index_weight_percent=15.0,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    rule = entry_to_rule_definition(entry)

    assert rule.band == ThresholdBand.CRITICAL
    assert rule.min_value is None
    assert rule.rule_id == "R-TEMP-CRITICAL"


# ── DB fetching ───────────────────────────────────────────────────────────────


def test_fetch_rules_from_db_returns_approved_only(db_session):
    """fetch_rules_from_db returns only approved entries."""
    # Clean up entries from previous tests
    for entry in db_session.exec(select(RulebookEntry)).all():
        db_session.delete(entry)
    db_session.commit()

    approved = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="range",
        min_value=0.0,
        max_value=800.0,
        unit="ppm",
        context_scope="general",
        interpretation_template="CO2 is good.",
        business_impact_template="Normal cognition.",
        recommendation_template="No action.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-CO2-001",
        index_weight_percent=25.0,
    )
    db_session.add(approved)

    draft = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="range",
        min_value=500.0,
        max_value=700.0,
        unit="ppm",
        context_scope="general",
        interpretation_template="Draft rule.",
        business_impact_template="Draft.",
        recommendation_template="Draft.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="draft",
        citation_unit_ids="CIT-CO2-DRAFT",
        index_weight_percent=25.0,
    )
    db_session.add(draft)
    db_session.commit()

    rules = fetch_rules_from_db(db_session, "v1.0")

    assert len(rules) == 1
    assert rules[0].band == ThresholdBand.GOOD


def test_fetch_rules_from_db_empty_when_no_rules(db_session):
    """fetch_rules_from_db returns empty list when no rules exist."""
    # Clean up entries from previous tests
    for entry in db_session.exec(select(RulebookEntry)).all():
        db_session.delete(entry)
    db_session.commit()

    rules = fetch_rules_from_db(db_session, "v1.0")
    assert len(rules) == 0


# ── Latest approved version ──────────────────────────────────────────────────


def test_get_latest_approved_version(db_session):
    """get_latest_approved_version returns the latest rule_version with approved entries."""
    entry = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="range",
        min_value=0.0,
        max_value=800.0,
        unit="ppm",
        context_scope="general",
        interpretation_template="CO2 is good.",
        business_impact_template="Normal.",
        recommendation_template="No action.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-CO2-001",
        index_weight_percent=25.0,
    )
    db_session.add(entry)
    db_session.commit()

    version = get_latest_approved_version(db_session)
    assert version == "v1.0"


def test_get_latest_approved_version_returns_none_when_empty(db_session):
    """Returns None when no approved rules exist."""
    for entry in db_session.exec(select(RulebookEntry)).all():
        db_session.delete(entry)
    db_session.commit()

    version = get_latest_approved_version(db_session)
    assert version is None
