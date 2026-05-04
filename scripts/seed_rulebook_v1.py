#!/usr/bin/env python3
"""
scripts/seed_rulebook_v1.py

Seeds the rulebook database with rules organized by certification standard.

Sources (from assets/standards/sources/ [FJ]-marked PDFs):
  1. [FJ] SS 554 2016 IAQ Standards.pdf
  2. [FJ] WELL Performance Verification Guidebook 2022.pdf
  3. [FJ] RESET_Viral_Index_v1_1_FINAL_230116.pdf

SafeSpace IAQ Standard: coming soon — registered but no rules ingested yet.

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/seed_rulebook_v1.py

Idempotent: Re-running clears existing v2-refactor entries and recreates.
Rule version: "v2-refactor"
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from sqlmodel import Session, select, col
from app.database import engine
from app.models.workflow_a import ReferenceSource, CitationUnit, RulebookEntry
from app.models.enums import MetricName, ConfidenceLevel, Priority, SourceCurrency

RULE_VERSION = "v2-refactor"
EFFECTIVE_FROM = datetime(2026, 5, 3, tzinfo=timezone.utc)


def cleanup(session: Session):
    """Delete all existing v2-refactor entries before re-seeding."""
    rules = session.exec(
        select(RulebookEntry).where(col(RulebookEntry.rule_version) == RULE_VERSION)
    ).all()
    for r in rules:
        session.delete(r)

    cits = session.exec(
        select(CitationUnit).where(
            col(CitationUnit.source_id).in_(
                select(ReferenceSource.id).where(col(ReferenceSource.source_type) == "standard")
            )
        )
    ).all()
    for c in cits:
        session.delete(c)

    sources = session.exec(
        select(ReferenceSource).where(col(ReferenceSource.source_type) == "standard")
    ).all()
    for s in sources:
        session.delete(s)

    session.flush()


def get_or_create_source(session: Session, **kwargs) -> ReferenceSource:
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
    existing = session.exec(
        select(RulebookEntry).where(
            col(RulebookEntry.metric_name) == kwargs["metric_name"],
            col(RulebookEntry.threshold_type) == kwargs["threshold_type"],
            col(RulebookEntry.min_value) == kwargs.get("min_value"),
            col(RulebookEntry.max_value) == kwargs.get("max_value"),
            col(RulebookEntry.rule_version) == kwargs["rule_version"],
            col(RulebookEntry.reference_source_id) == kwargs.get("reference_source_id"),
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
    print("Clearing existing rulebook data...")
    cleanup(session)
    print("Done.")

    # ── Reference Sources ─────────────────────────────────────────────────────

    sources = {}

    # SS 554: Singapore's IAQ Code of Practice
    sources["SS554"] = get_or_create_source(
        session,
        title="SS 554: Code of Practice for Indoor Air Quality in Air-Conditioned Buildings",
        publisher="Enterprise Singapore / SPRING Singapore",
        source_type="standard",
        jurisdiction="SG",
        version_label="2016 Amendment 1:2021",
        published_date=datetime(2016, 1, 1, tzinfo=timezone.utc),
        effective_date=datetime(2021, 8, 1, tzinfo=timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )

    # WELL Building Standard v2
    sources["WELL"] = get_or_create_source(
        session,
        title="WELL Building Standard",
        publisher="International WELL Building Institute (IWBI)",
        source_type="standard",
        jurisdiction="global",
        version_label="v2",
        published_date=datetime(2022, 10, 1, tzinfo=timezone.utc),
        effective_date=datetime(2022, 10, 1, tzinfo=timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )

    # RESET Viral Index
    sources["RESET"] = get_or_create_source(
        session,
        title="RESET Viral Index",
        publisher="GAMA (Global Architecture Monitoring Alliance)",
        source_type="standard",
        jurisdiction="global",
        version_label="v1.1",
        published_date=datetime(2022, 11, 29, tzinfo=timezone.utc),
        effective_date=datetime(2022, 11, 29, tzinfo=timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )

    # SafeSpace — coming soon, no rules
    sources["SAFESPACE"] = get_or_create_source(
        session,
        title="SafeSpace IAQ Standard",
        publisher="FJ SafeSpace",
        source_type="standard",
        jurisdiction="global",
        version_label="v1",
        published_date=datetime(2026, 5, 3, tzinfo=timezone.utc),
        effective_date=None,
        status="active",
        source_currency_status=SourceCurrency.VERSION_UNVERIFIED,
        source_completeness_status="coming_soon",
    )

    # ─ Citation Units ────────────────────────────────────────────────────────

    def cit(source_key: str, section: str) -> str:
        c = get_or_create_citation(session, source_id=sources[source_key].id, page_or_section=section)
        return c.id

    # SS 554 citations
    cit_ss554_co2 = cit("SS554", "SS 554:2016 Amdt 1:2021, Section 5.2.1 — CO2")
    cit_ss554_pm25 = cit("SS554", "SS 554:2016 Amdt 1:2021, Section 5.2.2 — PM2.5")
    cit_ss554_temp = cit("SS554", "SS 554:2016 Amdt 1:2021, Section 5.1 — Temperature")
    cit_ss554_hum = cit("SS554", "SS 554:2016 Amdt 1:2021, Section 5.1 — Humidity")

    # WELL citations
    cit_well_co2_g = cit("WELL", "WELL v2, A01: Air Quality — CO2 GOOD (< 800 ppm)")
    cit_well_co2_w = cit("WELL", "WELL v2, A01: Air Quality — CO2 WATCH (800-1200 ppm)")
    cit_well_co2_c = cit("WELL", "WELL v2, A01: Air Quality — CO2 CRITICAL (> 1200 ppm)")
    cit_well_pm25_g = cit("WELL", "WELL v2, A01: PM2.5 GOOD (< 15 ug/m3)")
    cit_well_pm25_w = cit("WELL", "WELL v2, A01: PM2.5 WATCH (15-35 ug/m3)")
    cit_well_pm25_c = cit("WELL", "WELL v2, A01: PM2.5 CRITICAL (> 35 ug/m3)")
    cit_well_tvoc_g = cit("WELL", "WELL v2, Feature 01: TVOC GOOD (< 500 ug/m3)")
    cit_well_tvoc_w = cit("WELL", "WELL v2, Feature 01: TVOC WATCH (500-660 ug/m3)")
    cit_well_tvoc_c = cit("WELL", "WELL v2, Feature 01: TVOC CRITICAL (> 660 ug/m3)")

    # RESET citations
    cit_reset_pm25 = cit("RESET", "RESET Viral Index v1.1 — PM2.5 Health Impact (ISPM)")
    cit_reset_co2 = cit("RESET", "RESET Viral Index v1.1 — Potential Viral Dosage (PVDr)")
    cit_reset_hum = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability (VS) optimal RH")
    cit_reset_temp = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability (VS) baseline temp")

    # SafeSpace: no citations — coming soon

    # ── Rulebook Entries ─────────────────────────────────────────────────────

    # ── SS 554 Rules (approved) ───────────────────────────────────────────────

    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        min_value=None, max_value=1000.0, unit="ppm", context_scope="office",
        interpretation_template="CO2 level of {value} ppm is within SS 554 acceptable limits.",
        business_impact_template="CO2 above 1000 ppm indicates inadequate ventilation per SS 554.",
        recommendation_template="Increase outdoor air ventilation rate per SS 554 requirements.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_co2, index_weight_percent=25.0,
        reference_source_id=sources["SS554"].id,
    )

    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        min_value=None, max_value=35.0, unit="ug/m3", context_scope="office",
        interpretation_template="PM2.5 level of {value} ug/m3 is within SS 554 acceptable limits.",
        business_impact_template="PM2.5 above 35 ug/m3 exceeds SS 554 24-hour standard.",
        recommendation_template="Install HEPA filtration per SS 554 guidelines.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_pm25, index_weight_percent=20.0,
        reference_source_id=sources["SS554"].id,
    )

    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        min_value=23.0, max_value=26.0, unit="deg C", context_scope="office",
        interpretation_template="Temperature of {value} deg C is within SS 554 thermal comfort range.",
        business_impact_template="Temperature outside 23-26 deg C affects occupant comfort per SS 554.",
        recommendation_template="Adjust HVAC setpoints per SS 554 guidelines.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_temp, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )

    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        min_value=40.0, max_value=70.0, unit="%RH", context_scope="office",
        interpretation_template="Humidity of {value}%RH is within SS 554 acceptable range.",
        business_impact_template="Humidity outside 40-70% RH may cause mold or dryness per SS 554.",
        recommendation_template="Adjust humidification/dehumidification per SS 554.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_hum, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )

    # ── WELL v2 Rules (approved) ──────────────────────────────────────────────

    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="range",
        min_value=300.0, max_value=800.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is within WELL acceptable range.",
        business_impact_template="Cognitive function is expected to be normal per WELL v2.",
        recommendation_template="No action required. Maintain current ventilation.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_co2_g, index_weight_percent=25.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="range",
        min_value=800.0, max_value=1200.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is elevated per WELL v2.",
        business_impact_template="Mild reduction in cognitive performance per WELL v2.",
        recommendation_template="Increase fresh air exchange rate.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_co2_w, index_weight_percent=25.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        min_value=1200.0, max_value=None, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm exceeds WELL v2 limits.",
        business_impact_template="Significant cognitive impairment per WELL v2.",
        recommendation_template="Immediately increase ventilation.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_co2_c, index_weight_percent=25.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="range",
        min_value=0.0, max_value=15.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is within WELL v2 guideline.",
        business_impact_template="Respiratory health risk is low per WELL v2.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_pm25_g, index_weight_percent=20.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="range",
        min_value=15.0, max_value=35.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 exceeds WELL v2 guideline.",
        business_impact_template="Sensitive individuals may experience irritation per WELL v2.",
        recommendation_template="Check air filtration.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_pm25_w, index_weight_percent=20.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        min_value=35.0, max_value=None, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is at unhealthy levels per WELL v2.",
        business_impact_template="Increased risk of respiratory symptoms per WELL v2.",
        recommendation_template="Activate HEPA filtration. Notify occupants.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_pm25_c, index_weight_percent=20.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.tvoc_ppb, threshold_type="range",
        min_value=0.0, max_value=500.0, unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb is within WELL v2 acceptable range.",
        business_impact_template="No immediate health effects expected per WELL v2.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_tvoc_g, index_weight_percent=15.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.tvoc_ppb, threshold_type="range",
        min_value=500.0, max_value=660.0, unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb is elevated per WELL v2.",
        business_impact_template="Possible headaches or irritation per WELL v2.",
        recommendation_template="Identify and remove VOC sources.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_tvoc_w, index_weight_percent=15.0,
        reference_source_id=sources["WELL"].id,
    )

    upsert_rule(session, metric_name=MetricName.tvoc_ppb, threshold_type="upper_bound",
        min_value=660.0, max_value=None, unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb exceeds WELL v2 limits.",
        business_impact_template="Significant risk of acute health symptoms per WELL v2.",
        recommendation_template="Conduct source investigation.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_tvoc_c, index_weight_percent=15.0,
        reference_source_id=sources["WELL"].id,
    )

    # ── RESET Viral Index Rules (approved) ───────────────────────────────────

    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        min_value=None, max_value=15.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is within RESET Viral Index guideline.",
        business_impact_template="PM2.5 above 15 ug/m3 increases immune system impact per RESET v1.1.",
        recommendation_template="Reduce PM2.5 to minimize viral transmission risk.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_pm25, index_weight_percent=20.0,
        reference_source_id=sources["RESET"].id,
    )

    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        min_value=None, max_value=1000.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is within RESET Viral Index limits.",
        business_impact_template="CO2 above 1000 ppm indicates elevated viral dosage risk per RESET.",
        recommendation_template="Increase ventilation to reduce potential viral dosage.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_co2, index_weight_percent=25.0,
        reference_source_id=sources["RESET"].id,
    )

    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        min_value=40.0, max_value=60.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is optimal for viral survivability per RESET.",
        business_impact_template="Humidity outside 40-60% RH increases virus survivability per RESET.",
        recommendation_template="Maintain 40-60% RH to minimize viral transmission risk.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_hum, index_weight_percent=15.0,
        reference_source_id=sources["RESET"].id,
    )

    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        min_value=20.0, max_value=24.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is within RESET Viral Index baseline.",
        business_impact_template="Temperature outside baseline affects virus survivability per RESET.",
        recommendation_template="Maintain 20-24 deg C for optimal viral control.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_temp, index_weight_percent=10.0,
        reference_source_id=sources["RESET"].id,
    )

    # SafeSpace: no rules — coming soon


def main():
    print("=" * 60)
    print("Seeding rulebook v2-refactor — 3 standards + SafeSpace (coming soon)")
    print("=" * 60)

    with Session(engine) as session:
        seed_rulebook(session)
        session.commit()

    with Session(engine) as session:
        all_sources = session.exec(select(ReferenceSource)).all()
        all_citations = session.exec(select(CitationUnit)).all()
        all_rules = session.exec(
            select(RulebookEntry).where(col(RulebookEntry.rule_version) == RULE_VERSION)
        ).all()

    print(f"Seeded: {len(all_sources)} sources, {len(all_citations)} citations, {len(all_rules)} rules")
    for src in all_sources:
        rule_count = len([r for r in all_rules if r.reference_source_id == src.id])
        print(f"  - {src.title} ({src.status}): {rule_count} rules")
    print("=" * 60)


if __name__ == "__main__":
    main()
