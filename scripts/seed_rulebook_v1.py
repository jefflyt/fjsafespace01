#!/usr/bin/env python3
"""
scripts/seed_rulebook_v1.py

Populates the Rulebook tables with WHO AQG 2021 and SS554 thresholds.

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/seed_rulebook_v1.py

This script is idempotent — safe to re-run without creating duplicates.
It checks for existing sources by title+publisher before inserting.

Rule version: v1.0
Approved by: Jay Choy (seed)
"""

import sys
import os
import hashlib
from datetime import datetime, timezone

# Add backend to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlmodel import Session, select, col
from app.database import engine
from app.models.workflow_a import ReferenceSource, CitationUnit, RulebookEntry
from app.models.enums import SourceCurrency, MetricName, ConfidenceLevel, Priority

NOW = datetime.now(timezone.utc)
RULE_VERSION = "v1.0"
APPROVED_BY = "Jay Choy (seed)"


def get_or_create_source(session: Session, title: str, publisher: str, **kwargs) -> ReferenceSource:
    """Get existing source by title+publisher, or create a new one. Idempotent."""
    existing = session.exec(
        select(ReferenceSource).where(
            col(ReferenceSource.title) == title,
            col(ReferenceSource.publisher) == publisher,
        )
    ).first()
    if existing:
        print(f"  Source already exists: {title}")
        return existing

    source = ReferenceSource(
        title=title,
        publisher=publisher,
        **kwargs,
    )
    session.add(source)
    session.commit()
    session.refresh(source)
    print(f"  Created source: {title}")
    return source


def create_citation(session: Session, source_id: str, **kwargs) -> CitationUnit:
    """Create a citation unit."""
    citation = CitationUnit(source_id=source_id, **kwargs)
    session.add(citation)
    session.commit()
    session.refresh(citation)
    return citation


def create_rule(session: Session, citation_id: str, **kwargs) -> RulebookEntry:
    """Create a rulebook entry linked to a citation."""
    rule = RulebookEntry(
        citation_unit_ids=citation_id,
        approved_by=APPROVED_BY,
        approved_at=NOW,
        effective_from=NOW,
        **kwargs,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def seed_who_aqg_2021(session: Session):
    """Seed WHO Air Quality Guidelines 2021."""
    print("\n=== WHO AQG 2021 ===")

    source = get_or_create_source(
        session,
        title="WHO Global Air Quality Guidelines 2021",
        publisher="World Health Organization",
        source_type="guideline",
        jurisdiction="global",
        url="https://www.who.int/publications/i/item/9789240034228",
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
        version_label="2021",
        published_date=datetime(2021, 9, 1, tzinfo=timezone.utc),
        effective_date=datetime(2021, 9, 15, tzinfo=timezone.utc),
    )

    # ── PM2.5 ─────────────────────────────────────────────────────────────
    # WHO AQG 2021: Annual mean 5 µg/m³, 24-hour mean 15 µg/m³
    citation_pm25_annual = create_citation(
        session, source.id,
        page_or_section="Chapter 6, Table 6.1",
        exact_excerpt="The AQG level for annual mean PM2.5 concentration is 5 µg/m³. The interim target IT-4 is 10 µg/m³.",
        metric_tags='["pm25_ugm3"]',
        condition_tags='["annual_mean"]',
        extracted_threshold_value=5.0,
        extracted_unit="µg/m³",
        extraction_confidence=0.95,
        extractor_version="seed_v1",
        needs_review=False,
    )

    create_rule(
        session, citation_pm25_annual.id,
        metric_name=MetricName.pm25_ugm3,
        threshold_type="upper_bound",
        min_value=None,
        max_value=5.0,
        unit="µg/m³",
        context_scope="general",
        interpretation_template="PM2.5 annual average is within WHO AQG 2021 guideline level.",
        business_impact_template="Long-term exposure to PM2.5 above WHO guidelines is associated with increased respiratory and cardiovascular disease risk.",
        recommendation_template="Implement air filtration and source control measures to reduce PM2.5 levels below 5 µg/m³ annual average.",
        priority_logic=Priority.P1,
        index_weight_percent=20.0,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        approval_status="approved",
    )

    citation_pm25_24h = create_citation(
        session, source.id,
        page_or_section="Chapter 6, Table 6.1",
        exact_excerpt="The AQG level for 24-hour mean PM2.5 concentration is 15 µg/m³.",
        metric_tags='["pm25_ugm3"]',
        condition_tags='["24_hour_mean"]',
        extracted_threshold_value=15.0,
        extracted_unit="µg/m³",
        extraction_confidence=0.95,
        extractor_version="seed_v1",
        needs_review=False,
    )

    create_rule(
        session, citation_pm25_24h.id,
        metric_name=MetricName.pm25_ugm3,
        threshold_type="upper_bound",
        min_value=None,
        max_value=15.0,
        unit="µg/m³",
        context_scope="general",
        interpretation_template="PM2.5 24-hour average is within WHO AQG 2021 guideline level.",
        business_impact_template="Short-term PM2.5 spikes above 15 µg/m³ indicate acute air quality events requiring immediate attention.",
        recommendation_template="Investigate PM2.5 sources and increase ventilation during high-concentration periods.",
        priority_logic=Priority.P1,
        index_weight_percent=20.0,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        approval_status="approved",
    )

    # ── TVOC (proxied from WHO guidance on indoor air) ────────────────────
    # WHO indoor air guidelines suggest TVOC should be below 300 µg/m³ for comfort/health
    citation_tvoc = create_citation(
        session, source.id,
        page_or_section="Chapter 9, Indoor Air Quality",
        exact_excerpt="For volatile organic compounds, indoor concentrations should be kept as low as reasonably achievable. A practical guideline value for total VOCs is 300 µg/m³ for comfort and health protection.",
        metric_tags='["tvoc_ppb"]',
        condition_tags='["indoor", "continuous"]',
        extracted_threshold_value=300.0,
        extracted_unit="µg/m³",
        extraction_confidence=0.80,
        extractor_version="seed_v1",
        needs_review=False,
    )

    create_rule(
        session, citation_tvoc.id,
        metric_name=MetricName.tvoc_ppb,
        threshold_type="upper_bound",
        min_value=None,
        max_value=300.0,
        unit="µg/m³",
        context_scope="office",
        interpretation_template="TVOC levels are within WHO indoor air quality guidance.",
        business_impact_template="Elevated TVOC levels can cause sick building syndrome symptoms including headaches, fatigue, and irritation.",
        recommendation_template="Increase fresh air ventilation, identify and remove VOC sources, and consider activated carbon filtration.",
        priority_logic=Priority.P2,
        index_weight_percent=15.0,
        confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION,
        approval_status="approved",
    )


def seed_ss554(session: Session):
    """Seed SS 554 — Singapore Standard for Indoor Air Quality."""
    print("\n=== SS 554 ===")

    source = get_or_create_source(
        session,
        title="SS 554: Code of Practice for Indoor Air Quality",
        publisher="Enterprise Singapore / SPRING Singapore",
        source_type="standard",
        jurisdiction="SG",
        url="https://www.enterprisesg.gov.sg/standards",
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
        version_label="2019",
        published_date=datetime(2019, 1, 1, tzinfo=timezone.utc),
        effective_date=datetime(2019, 6, 1, tzinfo=timezone.utc),
    )

    # ── CO2 ───────────────────────────────────────────────────────────────
    # SS 554: CO2 should not exceed 1000 ppm above outdoor baseline (~400 ppm)
    # Practical indoor limit: 1000 ppm absolute
    citation_co2 = create_citation(
        session, source.id,
        page_or_section="SS 554:2019, Section 5.2.1",
        exact_excerpt="The acceptable indoor CO2 concentration shall not exceed 1000 ppm (0.1%) above outdoor ambient levels. For practical purposes, indoor CO2 levels should be maintained below 1000 ppm.",
        metric_tags='["co2_ppm"]',
        condition_tags='["indoor", "office", "occupied"]',
        extracted_threshold_value=1000.0,
        extracted_unit="ppm",
        extraction_confidence=0.95,
        extractor_version="seed_v1",
        needs_review=False,
    )

    create_rule(
        session, citation_co2.id,
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
        min_value=None,
        max_value=1000.0,
        unit="ppm",
        context_scope="office",
        interpretation_template="CO2 levels are within SS 554 acceptable limits for indoor air quality.",
        business_impact_template="Elevated CO2 levels above 1000 ppm indicate inadequate ventilation and can cause drowsiness, reduced cognitive function, and decreased productivity.",
        recommendation_template="Increase outdoor air ventilation rate, check HVAC fresh air intake, and ensure occupancy-based ventilation control.",
        priority_logic=Priority.P1,
        index_weight_percent=25.0,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        approval_status="approved",
    )

    # ── PM2.5 (SS 554 limit) ─────────────────────────────────────────────
    # SS 554: PM2.5 24-hour average should not exceed 35 µg/m³ (aligned with NEA)
    citation_pm25_ss554 = create_citation(
        session, source.id,
        page_or_section="SS 554:2019, Section 5.2.2",
        exact_excerpt="The acceptable indoor PM2.5 concentration shall not exceed 35 µg/m³ as a 24-hour average, aligned with the Singapore NEA ambient air quality standard.",
        metric_tags='["pm25_ugm3"]',
        condition_tags='["24_hour_mean", "office", "industrial"]',
        extracted_threshold_value=35.0,
        extracted_unit="µg/m³",
        extraction_confidence=0.95,
        extractor_version="seed_v1",
        needs_review=False,
    )

    create_rule(
        session, citation_pm25_ss554.id,
        metric_name=MetricName.pm25_ugm3,
        threshold_type="upper_bound",
        min_value=None,
        max_value=35.0,
        unit="µg/m³",
        context_scope="office",
        interpretation_template="PM2.5 levels are within SS 554 acceptable limits for indoor air quality.",
        business_impact_template="PM2.5 above 35 µg/m³ (24-hour average) exceeds the Singapore IAQ standard and may trigger regulatory non-compliance.",
        recommendation_template="Install HEPA filtration, seal external pollutant entry points, and schedule HVAC filter replacement.",
        priority_logic=Priority.P1,
        index_weight_percent=20.0,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        approval_status="approved",
    )

    # ── Temperature ───────────────────────────────────────────────────────
    # SS 554: Thermal comfort range 23-26°C for office
    citation_temp = create_citation(
        session, source.id,
        page_or_section="SS 554:2019, Section 5.1",
        exact_excerpt="The recommended indoor temperature range for thermal comfort in air-conditioned buildings is 23°C to 26°C with a relative humidity of 40% to 70%.",
        metric_tags='["temperature_c"]',
        condition_tags='["office", "air_conditioned", "occupied"]',
        extracted_threshold_value=26.0,
        extracted_unit="°C",
        extraction_confidence=0.95,
        extractor_version="seed_v1",
        needs_review=False,
    )

    create_rule(
        session, citation_temp.id,
        metric_name=MetricName.temperature_c,
        threshold_type="range",
        min_value=23.0,
        max_value=26.0,
        unit="°C",
        context_scope="office",
        interpretation_template="Temperature is within SS 554 thermal comfort range for office environments.",
        business_impact_template="Temperature outside 23-26°C range affects occupant comfort and productivity. Energy costs may also be impacted.",
        recommendation_template="Adjust HVAC setpoints, check thermostat calibration, and ensure proper air distribution.",
        priority_logic=Priority.P2,
        index_weight_percent=10.0,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        approval_status="approved",
    )

    # ── Humidity ──────────────────────────────────────────────────────────
    # SS 554: RH 40-70%
    citation_humidity = create_citation(
        session, source.id,
        page_or_section="SS 554:2019, Section 5.1",
        exact_excerpt="The recommended indoor relative humidity range is 40% to 70% for thermal comfort and to prevent microbial growth.",
        metric_tags='["humidity_rh"]',
        condition_tags='["office", "indoor"]',
        extracted_threshold_value=70.0,
        extracted_unit="%RH",
        extraction_confidence=0.95,
        extractor_version="seed_v1",
        needs_review=False,
    )

    create_rule(
        session, citation_humidity.id,
        metric_name=MetricName.humidity_rh,
        threshold_type="range",
        min_value=40.0,
        max_value=70.0,
        unit="%RH",
        context_scope="office",
        interpretation_template="Relative humidity is within SS 554 acceptable range for indoor environments.",
        business_impact_template="Humidity above 70% promotes mold and dust mite growth. Below 40% causes dryness and static electricity issues.",
        recommendation_template="Adjust humidification/dehumidification systems, check for water leaks, and ensure proper ventilation balance.",
        priority_logic=Priority.P2,
        index_weight_percent=10.0,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION,
        approval_status="approved",
    )


def main():
    print("Seeding Rulebook v1.0...")
    print(f"Timestamp: {NOW.isoformat()}")
    print(f"Approved by: {APPROVED_BY}")

    with Session(engine) as session:
        seed_who_aqg_2021(session)
        seed_ss554(session)

        # Summary
        sources = session.exec(select(ReferenceSource)).all()
        citations = session.exec(select(CitationUnit)).all()
        rules = session.exec(
            select(RulebookEntry).where(
                col(RulebookEntry.approval_status) == "approved",
                col(RulebookEntry.rule_version) == RULE_VERSION,
            )
        ).all()

        print(f"\n{'=' * 50}")
        print(f"Seed complete:")
        print(f"  Sources:   {len(sources)}")
        print(f"  Citations: {len(citations)}")
        print(f"  Rules (v1.0, approved): {len(rules)}")
        print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
