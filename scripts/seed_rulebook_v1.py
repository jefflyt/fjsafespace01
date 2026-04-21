#!/usr/bin/env python3
"""
scripts/seed_rulebook_v1.py

Seeds the rulebook database with the initial rule set (v1.0).

Populates three tables:
  1. reference_source — WELL, WHO, ASHRAE, IAQ guidelines
  2. citation_unit — verbatim excerpts linked to each source
  3. rulebook_entry — 20 rules covering CO2, PM2.5, TVOC, Temperature, Humidity
     with GOOD/WATCH/CRITICAL bands and index_weight_percent

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/seed_rulebook_v1.py

Idempotent: Re-running deletes and recreates entries for v1.0 only.
Rule version: "v1.0"
"""

import sys
import os
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from sqlmodel import Session, select, col
from app.database import engine
from app.models.workflow_a import ReferenceSource, CitationUnit, RulebookEntry
from app.models.enums import MetricName, ConfidenceLevel, Priority, SourceCurrency

RULE_VERSION = "v1.0"
EFFECTIVE_FROM = datetime(2026, 4, 21, tzinfo=timezone.utc)


def get_or_create_source(session: Session, **kwargs) -> ReferenceSource:
    """Get or create a ReferenceSource by title + version_label."""
    existing = session.exec(
        select(ReferenceSource).where(
            col(ReferenceSource.title) == kwargs["title"],
            col(ReferenceSource.version_label) == kwargs["version_label"],
        )
    ).first()
    if existing:
        return existing
    source = ReferenceSource(**kwargs)
    session.add(source)
    session.flush()
    return source


def get_or_create_citation(session: Session, source_id: str, page_or_section: str) -> CitationUnit:
    """Get or create a CitationUnit by source_id + page_or_section."""
    existing = session.exec(
        select(CitationUnit).where(
            col(CitationUnit.source_id) == source_id,
            col(CitationUnit.page_or_section) == page_or_section,
        )
    ).first()
    if existing:
        return existing
    citation = CitationUnit(
        source_id=source_id,
        page_or_section=page_or_section,
        exact_excerpt="",
        metric_tags="[]",
        condition_tags="[]",
    )
    session.add(citation)
    session.flush()
    return citation


def upsert_rule(session: Session, **kwargs) -> RulebookEntry:
    """Upsert a RulebookEntry by metric_name + threshold_type + min_value + max_value + rule_version."""
    existing = session.exec(
        select(RulebookEntry).where(
            col(RulebookEntry.metric_name) == kwargs["metric_name"],
            col(RulebookEntry.threshold_type) == kwargs["threshold_type"],
            col(RulebookEntry.min_value) == kwargs.get("min_value"),
            col(RulebookEntry.max_value) == kwargs.get("max_value"),
            col(RulebookEntry.rule_version) == kwargs["rule_version"],
        )
    ).first()
    if existing:
        for key, value in kwargs.items():
            setattr(existing, key, value)
        return existing
    entry = RulebookEntry(**kwargs)
    session.add(entry)
    return entry


def seed_rulebook(session: Session):
    """Populate the rulebook with v1.0 rules."""

    # ── 1. Reference Sources ──────────────────────────────────────────────────

    sources = {}

    sources["WELL"] = get_or_create_source(
        session,
        title="WELL Building Standard",
        publisher="International WELL Building Institute (IWBI)",
        source_type="standard",
        jurisdiction="global",
        version_label="v2",
        published_date=datetime(2019, 1, 1, tzinfo=timezone.utc),
        effective_date=datetime(2019, 1, 1, tzinfo=timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )

    sources["WHO"] = get_or_create_source(
        session,
        title="WHO Global Air Quality Guidelines 2021",
        publisher="World Health Organization",
        source_type="guideline",
        jurisdiction="global",
        version_label="2021",
        published_date=datetime(2021, 9, 1, tzinfo=timezone.utc),
        effective_date=datetime(2021, 9, 15, tzinfo=timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )

    sources["ASHRAE"] = get_or_create_source(
        session,
        title="ASHRAE Standard 62.1",
        publisher="ASHRAE",
        source_type="standard",
        jurisdiction="US",
        version_label="2022",
        published_date=datetime(2022, 1, 1, tzinfo=timezone.utc),
        effective_date=datetime(2022, 1, 1, tzinfo=timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )

    sources["IAQ"] = get_or_create_source(
        session,
        title="Indoor Air Quality Guidelines",
        publisher="IAQ Industry Standards",
        source_type="guideline",
        jurisdiction="global",
        version_label="2016",
        published_date=datetime(2016, 1, 1, tzinfo=timezone.utc),
        effective_date=datetime(2016, 1, 1, tzinfo=timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )

    # ── 2. Citation Units ─────────────────────────────────────────────────────

    def cit(source_key: str, section: str) -> str:
        """Get or create a citation, return its ID."""
        c = get_or_create_citation(session, source_id=sources[source_key].id, page_or_section=section)
        return c.id

    # WELL citations for CO2
    cit_well_001 = cit("WELL", "WELL v2, A01: Air Quality — CO2 GOOD (< 800 ppm)")
    cit_well_002 = cit("WELL", "WELL v2, A01: Air Quality — CO2 WATCH (800-1200 ppm)")
    cit_well_003 = cit("WELL", "WELL v2, A01: Air Quality — CO2 CRITICAL (> 1200 ppm)")

    # WHO citations for PM2.5
    cit_who_001 = cit("WHO", "WHO AQG 2021, Ch.6, Table 6.1 — PM2.5 GOOD (≤ 12 μg/m³)")
    cit_who_002 = cit("WHO", "WHO AQG 2021, Ch.6, Table 6.1 — PM2.5 WATCH (12-35 μg/m³)")
    cit_who_003 = cit("WHO", "WHO AQG 2021, Ch.6, Table 6.1 — PM2.5 CRITICAL (> 35 μg/m³)")

    # IAQ citations for TVOC
    cit_iaq_001 = cit("IAQ", "IAQ Guidelines — TVOC GOOD (< 220 ppb)")
    cit_iaq_002 = cit("IAQ", "IAQ Guidelines — TVOC WATCH (220-660 ppb)")
    cit_iaq_003 = cit("IAQ", "IAQ Guidelines — TVOC CRITICAL (> 660 ppb)")

    # ASHRAE citations for Temperature and Humidity
    cit_ash_001 = cit("ASHRAE", "ASHRAE 62.1 — Temperature GOOD (20-26°C)")
    cit_ash_002 = cit("ASHRAE", "ASHRAE 62.1 — Temperature WATCH (17-20°C or 26-30°C)")
    cit_ash_003 = cit("ASHRAE", "ASHRAE 62.1 — Temperature CRITICAL (< 10°C or > 30°C)")
    cit_ash_004 = cit("ASHRAE", "ASHRAE 62.1 — Humidity GOOD (30-60%RH)")
    cit_ash_005 = cit("ASHRAE", "ASHRAE 62.1 — Humidity WATCH (20-30%RH or 60-70%RH)")
    cit_ash_006 = cit("ASHRAE", "ASHRAE 62.1 — Humidity CRITICAL (< 20%RH or > 70%RH)")

    # ── 3. Rulebook Entries (20 rules matching _DEFAULT_RULES) ────────────────

    # CO2
    upsert_rule(session,
        metric_name=MetricName.co2_ppm,
        threshold_type="range",
        min_value=300.0, max_value=800.0,
        unit="ppm", context_scope="general",
        interpretation_template="CO₂ level of {value} ppm is within acceptable indoor range.",
        business_impact_template="Cognitive function is expected to be normal at this level.",
        recommendation_template="No action required. Maintain current ventilation.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_well_001,
        index_weight_percent=25.0,
    )

    upsert_rule(session,
        metric_name=MetricName.co2_ppm,
        threshold_type="range",
        min_value=800.0, max_value=1200.0,
        unit="ppm", context_scope="general",
        interpretation_template="CO₂ level of {value} ppm is elevated. Drowsiness may increase.",
        business_impact_template="Mild reduction in cognitive performance may occur.",
        recommendation_template="Increase fresh air exchange rate. Monitor for sustained elevation.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_well_002,
        index_weight_percent=25.0,
    )

    upsert_rule(session,
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
        min_value=1200.0, max_value=None,
        unit="ppm", context_scope="general",
        interpretation_template="CO₂ level of {value} ppm exceeds safe indoor limits.",
        business_impact_template="Significant cognitive impairment and drowsiness likely.",
        recommendation_template="Immediately increase ventilation. Investigate HVAC or occupancy issues.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_well_003,
        index_weight_percent=25.0,
    )

    # PM2.5
    upsert_rule(session,
        metric_name=MetricName.pm25_ugm3,
        threshold_type="range",
        min_value=0.0, max_value=12.0,
        unit="μg/m³", context_scope="general",
        interpretation_template="PM2.5 level of {value} μg/m³ is within WHO guideline.",
        business_impact_template="Respiratory health risk is low.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_who_001,
        index_weight_percent=25.0,
    )

    upsert_rule(session,
        metric_name=MetricName.pm25_ugm3,
        threshold_type="range",
        min_value=12.0, max_value=35.0,
        unit="μg/m³", context_scope="general",
        interpretation_template="PM2.5 level of {value} μg/m³ exceeds WHO annual guideline.",
        business_impact_template="Sensitive individuals may experience mild respiratory irritation.",
        recommendation_template="Check air filtration. Consider reducing outdoor air intake during pollution events.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_who_002,
        index_weight_percent=25.0,
    )

    upsert_rule(session,
        metric_name=MetricName.pm25_ugm3,
        threshold_type="upper_bound",
        min_value=35.0, max_value=None,
        unit="μg/m³", context_scope="general",
        interpretation_template="PM2.5 level of {value} μg/m³ is at unhealthy levels.",
        business_impact_template="Increased risk of respiratory symptoms for all occupants.",
        recommendation_template="Activate HEPA filtration. Restrict outdoor air intake. Notify occupants.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_who_003,
        index_weight_percent=25.0,
    )

    # TVOC
    upsert_rule(session,
        metric_name=MetricName.tvoc_ppb,
        threshold_type="range",
        min_value=0.0, max_value=220.0,
        unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb is within acceptable range.",
        business_impact_template="No immediate health effects expected.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_iaq_001,
        index_weight_percent=20.0,
    )

    upsert_rule(session,
        metric_name=MetricName.tvoc_ppb,
        threshold_type="range",
        min_value=220.0, max_value=660.0,
        unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb is elevated. Off-gassing or chemical sources suspected.",
        business_impact_template="Possible headaches or irritation for sensitive occupants.",
        recommendation_template="Identify and remove VOC sources. Increase ventilation.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_iaq_002,
        index_weight_percent=20.0,
    )

    upsert_rule(session,
        metric_name=MetricName.tvoc_ppb,
        threshold_type="upper_bound",
        min_value=660.0, max_value=None,
        unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb exceeds safe exposure limits.",
        business_impact_template="Significant risk of acute health symptoms.",
        recommendation_template="Evacuate if occupants report symptoms. Conduct source investigation.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_iaq_003,
        index_weight_percent=20.0,
    )

    # Temperature
    upsert_rule(session,
        metric_name=MetricName.temperature_c,
        threshold_type="range",
        min_value=20.0, max_value=26.0,
        unit="°C", context_scope="general",
        interpretation_template="Temperature of {value}°C is within thermal comfort zone.",
        business_impact_template="Comfortable conditions for productivity.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_001,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.temperature_c,
        threshold_type="range",
        min_value=17.0, max_value=20.0,
        unit="°C", context_scope="general",
        interpretation_template="Temperature of {value}°C is below comfort range.",
        business_impact_template="Occupants may feel uncomfortably cool.",
        recommendation_template="Adjust heating setpoint. Check for drafts.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_002,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.temperature_c,
        threshold_type="range",
        min_value=26.0, max_value=30.0,
        unit="°C", context_scope="general",
        interpretation_template="Temperature of {value}°C is above comfort range.",
        business_impact_template="Mild heat stress may reduce productivity.",
        recommendation_template="Adjust cooling setpoint. Verify HVAC operation.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_002,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.temperature_c,
        threshold_type="upper_bound",
        min_value=30.0, max_value=None,
        unit="°C", context_scope="general",
        interpretation_template="Temperature of {value}°C exceeds safe workplace limits.",
        business_impact_template="Heat stress risk. Productivity significantly impaired.",
        recommendation_template="Activate emergency cooling. Allow remote work if conditions persist.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_003,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.temperature_c,
        threshold_type="lower_bound",
        min_value=None, max_value=10.0,
        unit="°C", context_scope="general",
        interpretation_template="Temperature of {value}°C is below safe workplace limits.",
        business_impact_template="Cold stress risk. Dexterity and comfort significantly reduced.",
        recommendation_template="Activate emergency heating. Inspect for heating system failure.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_003,
        index_weight_percent=15.0,
    )

    # Humidity
    upsert_rule(session,
        metric_name=MetricName.humidity_rh,
        threshold_type="range",
        min_value=30.0, max_value=60.0,
        unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is within ideal range.",
        business_impact_template="Comfortable conditions. Low mold and mite risk.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_004,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.humidity_rh,
        threshold_type="range",
        min_value=20.0, max_value=30.0,
        unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is dry. Static and dryness likely.",
        business_impact_template="Dry skin and respiratory irritation possible.",
        recommendation_template="Consider humidification. Monitor for static-sensitive equipment.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_005,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.humidity_rh,
        threshold_type="range",
        min_value=60.0, max_value=70.0,
        unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is elevated. Mold growth conditions possible.",
        business_impact_template="Allergen levels may increase.",
        recommendation_template="Activate dehumidification. Check for moisture intrusion.",
        priority_logic=Priority.P2,
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_005,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.humidity_rh,
        threshold_type="upper_bound",
        min_value=70.0, max_value=None,
        unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH creates high mold and pathogen risk.",
        business_impact_template="Significant allergen and respiratory health risk.",
        recommendation_template="Immediate dehumidification. Inspect for water damage.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_006,
        index_weight_percent=15.0,
    )

    upsert_rule(session,
        metric_name=MetricName.humidity_rh,
        threshold_type="lower_bound",
        min_value=None, max_value=20.0,
        unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is critically low.",
        business_impact_template="Severe dryness. Static discharge and equipment risk.",
        recommendation_template="Emergency humidification required.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        effective_from=EFFECTIVE_FROM,
        approval_status="approved",
        citation_unit_ids=cit_ash_006,
        index_weight_percent=15.0,
    )


def main():
    print("=" * 60)
    print("Seeding rulebook v1.0")
    print("=" * 60)

    with Session(engine) as session:
        seed_rulebook(session)
        session.commit()

    # Verify
    with Session(engine) as session:
        sources = session.exec(select(ReferenceSource)).all()
        citations = session.exec(select(CitationUnit)).all()
        rules = session.exec(
            select(RulebookEntry).where(
                col(RulebookEntry.rule_version) == RULE_VERSION,
                col(RulebookEntry.approval_status) == "approved",
            )
        ).all()

    print(f"Seeded: {len(sources)} sources, {len(citations)} citations, {len(rules)} rules")
    print("=" * 60)


if __name__ == "__main__":
    main()
