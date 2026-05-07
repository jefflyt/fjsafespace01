#!/usr/bin/env python3
"""
scripts/seed_rulebook_v1.py

Seeds the rulebook database with rules organized by certification standard.

Each metric per standard has explicit GOOD, WATCH, and CRITICAL bands
stored in the threshold_band column.

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
from sqlalchemy import text
from app.database import engine
from app.models.workflow_a import ReferenceSource, CitationUnit, RulebookEntry
from app.models.enums import MetricName, ConfidenceLevel, Priority, SourceCurrency

RULE_VERSION = "v2-refactor"
EFFECTIVE_FROM = datetime(2026, 5, 3, tzinfo=timezone.utc)


def cleanup(session: Session):
    """Delete all existing v2-refactor entries before re-seeding."""
    # Delete findings that reference our sources (FK constraint)
    from app.models.workflow_b import Finding as FindingModel

    source_ids = session.exec(
        select(ReferenceSource.id).where(col(ReferenceSource.source_type) == "standard")
    ).all()
    if source_ids:
        session.execute(
            text("DELETE FROM finding WHERE reference_source_id IN :ids"),
            {"ids": tuple(str(sid) for sid in source_ids)},
        )
        session.commit()

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
            col(RulebookEntry.threshold_band) == kwargs.get("threshold_band"),
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

    # SS 554 citations — one per metric-band pair
    cit_ss554_co2_g = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.2.1 — CO2 GOOD (< 1000 ppm)")
    cit_ss554_co2_w = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.2.1 — CO2 WATCH (1000-1500 ppm)")
    cit_ss554_co2_c = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.2.1 — CO2 CRITICAL (> 1500 ppm)")
    cit_ss554_pm25_g = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.2.2 — PM2.5 GOOD (< 35 μg/m³)")
    cit_ss554_pm25_w = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.2.2 — PM2.5 WATCH (35-75 μg/m³)")
    cit_ss554_pm25_c = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.2.2 — PM2.5 CRITICAL (> 75 μg/m³)")
    cit_ss554_temp_g = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Temperature GOOD (23-26°C)")
    cit_ss554_temp_wl = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Temperature WATCH LOW (20-23°C)")
    cit_ss554_temp_wh = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Temperature WATCH HIGH (26-29°C)")
    cit_ss554_temp_cl = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Temperature CRITICAL LOW (< 20°C)")
    cit_ss554_temp_ch = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Temperature CRITICAL HIGH (> 29°C)")
    cit_ss554_hum_g = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Humidity GOOD (40-70%RH)")
    cit_ss554_hum_wl = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Humidity WATCH LOW (30-40%RH)")
    cit_ss554_hum_wh = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Humidity WATCH HIGH (70-80%RH)")
    cit_ss554_hum_cl = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Humidity CRITICAL LOW (< 30%RH)")
    cit_ss554_hum_ch = cit("SS554", "SS 554:2016 Amdt 1:2021, Sec 5.1 — Humidity CRITICAL HIGH (> 80%RH)")

    # WELL citations — one per metric-band pair
    cit_well_co2_g = cit("WELL", "WELL v2, A01: Air Quality — CO2 GOOD (< 800 ppm)")
    cit_well_co2_w = cit("WELL", "WELL v2, A01: Air Quality — CO2 WATCH (800-1200 ppm)")
    cit_well_co2_c = cit("WELL", "WELL v2, A01: Air Quality — CO2 CRITICAL (> 1200 ppm)")
    cit_well_pm25_g = cit("WELL", "WELL v2, A01: PM2.5 GOOD (< 15 ug/m3)")
    cit_well_pm25_w = cit("WELL", "WELL v2, A01: PM2.5 WATCH (15-35 ug/m3)")
    cit_well_pm25_c = cit("WELL", "WELL v2, A01: PM2.5 CRITICAL (> 35 ug/m3)")
    cit_well_tvoc_g = cit("WELL", "WELL v2, Feature 01: TVOC GOOD (< 500 ug/m3)")
    cit_well_tvoc_w = cit("WELL", "WELL v2, Feature 01: TVOC WATCH (500-660 ug/m3)")
    cit_well_tvoc_c = cit("WELL", "WELL v2, Feature 01: TVOC CRITICAL (> 660 ug/m3)")

    # RESET citations — one per metric-band pair
    cit_reset_pm25_g = cit("RESET", "RESET Viral Index v1.1 — PM2.5 Health Impact GOOD (< 15 ISPM)")
    cit_reset_pm25_c = cit("RESET", "RESET Viral Index v1.1 — PM2.5 Health Impact CRITICAL (> 15 ISPM)")
    cit_reset_co2_g = cit("RESET", "RESET Viral Index v1.1 — Potential Viral Dosage GOOD (< 1000 ppm)")
    cit_reset_co2_c = cit("RESET", "RESET Viral Index v1.1 — Potential Viral Dosage CRITICAL (> 1000 ppm)")
    cit_reset_hum_g = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability GOOD RH (40-60%RH)")
    cit_reset_hum_wl = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability WATCH LOW RH (30-40%RH)")
    cit_reset_hum_wh = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability WATCH HIGH RH (60-70%RH)")
    cit_reset_hum_c = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability CRITICAL RH (outside 30-70%RH)")
    cit_reset_temp_g = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability GOOD temp (20-24°C)")
    cit_reset_temp_wl = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability WATCH LOW temp (17-20°C)")
    cit_reset_temp_wh = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability WATCH HIGH temp (24-27°C)")
    cit_reset_temp_c = cit("RESET", "RESET Viral Index v1.1 — Virus Survivability CRITICAL temp (outside 17-27°C)")

    # ── Rulebook Entries ─────────────────────────────────────────────────────
    # Each entry has explicit threshold_band: GOOD, WATCH, or CRITICAL

    # ── SS 554 Rules ─────────────────────────────────────────────────────────

    # CO2: GOOD < 1000, WATCH 1000-1500, CRITICAL > 1500
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        threshold_band="GOOD", min_value=None, max_value=1000.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is within SS 554 acceptable limits.",
        business_impact_template="CO2 below 1000 ppm indicates adequate ventilation per SS 554.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_co2_g, index_weight_percent=25.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="range",
        threshold_band="WATCH", min_value=1000.0, max_value=1500.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is elevated per SS 554 (1000-1500 ppm).",
        business_impact_template="CO2 above 1000 ppm indicates inadequate ventilation per SS 554.",
        recommendation_template="Increase outdoor air ventilation rate per SS 554 requirements.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_co2_w, index_weight_percent=25.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=1500.0, max_value=None, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm exceeds SS 554 safe limits (> 1500 ppm).",
        business_impact_template="CO2 above 1500 ppm indicates severely inadequate ventilation per SS 554.",
        recommendation_template="Immediately increase ventilation. Investigate HVAC or occupancy issues.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_co2_c, index_weight_percent=25.0,
        reference_source_id=sources["SS554"].id,
    )

    # PM2.5: GOOD < 35, WATCH 35-75, CRITICAL > 75
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        threshold_band="GOOD", min_value=None, max_value=35.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is within SS 554 acceptable limits.",
        business_impact_template="PM2.5 below 35 ug/m3 meets SS 554 24-hour standard.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_pm25_g, index_weight_percent=20.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="range",
        threshold_band="WATCH", min_value=35.0, max_value=75.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 exceeds SS 554 24-hour standard.",
        business_impact_template="PM2.5 above 35 ug/m3 exceeds SS 554 24-hour standard.",
        recommendation_template="Install HEPA filtration per SS 554 guidelines.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_pm25_w, index_weight_percent=20.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=75.0, max_value=None, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is at unhealthy levels per SS 554.",
        business_impact_template="PM2.5 above 75 ug/m3 significantly exceeds SS 554 limits.",
        recommendation_template="Activate HEPA filtration. Restrict outdoor air intake. Notify occupants.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_pm25_c, index_weight_percent=20.0,
        reference_source_id=sources["SS554"].id,
    )

    # Temperature: GOOD 23-26, WATCH LOW 20-23, WATCH HIGH 26-29, CRITICAL LOW <20, CRITICAL HIGH >29
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        threshold_band="GOOD", min_value=23.0, max_value=26.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is within SS 554 thermal comfort range.",
        business_impact_template="Temperature within 23-26 deg C meets SS 554 thermal comfort.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_temp_g, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        threshold_band="WATCH", min_value=20.0, max_value=23.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is below SS 554 comfort range.",
        business_impact_template="Temperature below 23 deg C affects occupant comfort per SS 554.",
        recommendation_template="Adjust heating setpoint. Check for drafts.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_temp_wl, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        threshold_band="WATCH", min_value=26.0, max_value=29.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is above SS 554 comfort range.",
        business_impact_template="Temperature above 26 deg C affects occupant comfort per SS 554.",
        recommendation_template="Adjust cooling setpoint. Verify HVAC operation.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_temp_wh, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="lower_bound",
        threshold_band="CRITICAL", min_value=None, max_value=20.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is critically low per SS 554.",
        business_impact_template="Temperature below 20 deg C is below safe workplace limits per SS 554.",
        recommendation_template="Activate emergency heating. Inspect for heating system failure.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_temp_cl, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=29.0, max_value=None, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C exceeds safe workplace limits per SS 554.",
        business_impact_template="Temperature above 29 deg C is unsafe per SS 554.",
        recommendation_template="Activate emergency cooling. Allow remote work if conditions persist.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_temp_ch, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )

    # Humidity: GOOD 40-70, WATCH LOW 30-40, WATCH HIGH 70-80, CRITICAL LOW <30, CRITICAL HIGH >80
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        threshold_band="GOOD", min_value=40.0, max_value=70.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is within SS 554 acceptable range.",
        business_impact_template="Humidity within 40-70% RH meets SS 554 requirements.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_hum_g, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        threshold_band="WATCH", min_value=30.0, max_value=40.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is dry per SS 554 (30-40%RH).",
        business_impact_template="Humidity below 40% RH may cause dryness per SS 554.",
        recommendation_template="Consider humidification. Monitor for static-sensitive equipment.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_hum_wl, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        threshold_band="WATCH", min_value=70.0, max_value=80.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is elevated per SS 554 (70-80%RH).",
        business_impact_template="Humidity above 70% RH may cause mold growth per SS 554.",
        recommendation_template="Activate dehumidification. Check for moisture intrusion.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_hum_wh, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="lower_bound",
        threshold_band="CRITICAL", min_value=None, max_value=30.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is critically low per SS 554.",
        business_impact_template="Humidity below 30% RH creates severe dryness risk.",
        recommendation_template="Emergency humidification required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_hum_cl, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=80.0, max_value=None, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH creates high mold risk per SS 554.",
        business_impact_template="Humidity above 80% RH creates significant allergen risk.",
        recommendation_template="Immediate dehumidification. Inspect for water damage.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_ss554_hum_ch, index_weight_percent=10.0,
        reference_source_id=sources["SS554"].id,
    )

    # ── WELL v2 Rules ─────────────────────────────────────────────────────────

    # CO2: GOOD < 800, WATCH 800-1200, CRITICAL > 1200
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        threshold_band="GOOD", min_value=None, max_value=800.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is within WELL acceptable range.",
        business_impact_template="Cognitive function is expected to be normal per WELL v2.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_co2_g, index_weight_percent=25.0,
        reference_source_id=sources["WELL"].id,
    )
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="range",
        threshold_band="WATCH", min_value=800.0, max_value=1200.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is elevated per WELL v2.",
        business_impact_template="Mild reduction in cognitive performance per WELL v2.",
        recommendation_template="Increase fresh air exchange rate.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_co2_w, index_weight_percent=25.0,
        reference_source_id=sources["WELL"].id,
    )
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=1200.0, max_value=None, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm exceeds WELL v2 limits.",
        business_impact_template="Significant cognitive impairment per WELL v2.",
        recommendation_template="Immediately increase ventilation.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_co2_c, index_weight_percent=25.0,
        reference_source_id=sources["WELL"].id,
    )

    # PM2.5: GOOD < 15, WATCH 15-35, CRITICAL > 35
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        threshold_band="GOOD", min_value=None, max_value=15.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is within WELL v2 guideline.",
        business_impact_template="Respiratory health risk is low per WELL v2.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_pm25_g, index_weight_percent=20.0,
        reference_source_id=sources["WELL"].id,
    )
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="range",
        threshold_band="WATCH", min_value=15.0, max_value=35.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 exceeds WELL v2 guideline.",
        business_impact_template="Sensitive individuals may experience irritation per WELL v2.",
        recommendation_template="Check air filtration.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_pm25_w, index_weight_percent=20.0,
        reference_source_id=sources["WELL"].id,
    )
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=35.0, max_value=None, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is at unhealthy levels per WELL v2.",
        business_impact_template="Increased risk of respiratory symptoms per WELL v2.",
        recommendation_template="Activate HEPA filtration. Notify occupants.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_pm25_c, index_weight_percent=20.0,
        reference_source_id=sources["WELL"].id,
    )

    # TVOC: GOOD < 500, WATCH 500-660, CRITICAL > 660
    upsert_rule(session, metric_name=MetricName.tvoc_ppb, threshold_type="upper_bound",
        threshold_band="GOOD", min_value=None, max_value=500.0, unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb is within WELL v2 acceptable range.",
        business_impact_template="No immediate health effects expected per WELL v2.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_tvoc_g, index_weight_percent=15.0,
        reference_source_id=sources["WELL"].id,
    )
    upsert_rule(session, metric_name=MetricName.tvoc_ppb, threshold_type="range",
        threshold_band="WATCH", min_value=500.0, max_value=660.0, unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb is elevated per WELL v2.",
        business_impact_template="Possible headaches or irritation per WELL v2.",
        recommendation_template="Identify and remove VOC sources.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_tvoc_w, index_weight_percent=15.0,
        reference_source_id=sources["WELL"].id,
    )
    upsert_rule(session, metric_name=MetricName.tvoc_ppb, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=660.0, max_value=None, unit="ppb", context_scope="general",
        interpretation_template="TVOC level of {value} ppb exceeds WELL v2 limits.",
        business_impact_template="Significant risk of acute health symptoms per WELL v2.",
        recommendation_template="Conduct source investigation.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_well_tvoc_c, index_weight_percent=15.0,
        reference_source_id=sources["WELL"].id,
    )

    # ── RESET Viral Index Rules ───────────────────────────────────────────────

    # PM2.5: GOOD < 15, CRITICAL > 15 (RESET only defines one threshold)
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        threshold_band="GOOD", min_value=None, max_value=15.0, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 is within RESET Viral Index guideline.",
        business_impact_template="PM2.5 below 15 ug/m3 minimizes immune system impact per RESET v1.1.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_pm25_g, index_weight_percent=20.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.pm25_ugm3, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=15.0, max_value=None, unit="ug/m3", context_scope="general",
        interpretation_template="PM2.5 level of {value} ug/m3 exceeds RESET Viral Index limit.",
        business_impact_template="PM2.5 above 15 ug/m3 increases immune system impact per RESET v1.1.",
        recommendation_template="Reduce PM2.5 to minimize viral transmission risk.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_pm25_c, index_weight_percent=20.0,
        reference_source_id=sources["RESET"].id,
    )

    # CO2: GOOD < 1000, CRITICAL > 1000 (RESET only defines one threshold)
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        threshold_band="GOOD", min_value=None, max_value=1000.0, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm is within RESET Viral Index limits.",
        business_impact_template="CO2 below 1000 ppm indicates low viral dosage risk per RESET.",
        recommendation_template="No action required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_co2_g, index_weight_percent=25.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.co2_ppm, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=1000.0, max_value=None, unit="ppm", context_scope="general",
        interpretation_template="CO2 level of {value} ppm exceeds RESET Viral Index limit.",
        business_impact_template="CO2 above 1000 ppm indicates elevated viral dosage risk per RESET.",
        recommendation_template="Increase ventilation to reduce potential viral dosage.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_co2_c, index_weight_percent=25.0,
        reference_source_id=sources["RESET"].id,
    )

    # Humidity: GOOD 40-60, WATCH LOW 30-40, WATCH HIGH 60-70, CRITICAL <30 or >70
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        threshold_band="GOOD", min_value=40.0, max_value=60.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is optimal for viral survivability per RESET.",
        business_impact_template="Humidity within 40-60% RH minimizes virus survivability per RESET.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_hum_g, index_weight_percent=15.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        threshold_band="WATCH", min_value=30.0, max_value=40.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is dry per RESET (30-40%RH).",
        business_impact_template="Humidity below 40% RH increases virus survivability per RESET.",
        recommendation_template="Increase humidification to reach 40-60% RH optimal range.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_hum_wl, index_weight_percent=15.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="range",
        threshold_band="WATCH", min_value=60.0, max_value=70.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is elevated per RESET (60-70%RH).",
        business_impact_template="Humidity above 60% RH increases virus survivability per RESET.",
        recommendation_template="Activate dehumidification to reach 40-60% RH optimal range.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_hum_wh, index_weight_percent=15.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="lower_bound",
        threshold_band="CRITICAL", min_value=None, max_value=30.0, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH is critically low per RESET.",
        business_impact_template="Humidity below 30% RH significantly increases virus survivability.",
        recommendation_template="Emergency humidification required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_hum_c, index_weight_percent=15.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.humidity_rh, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=70.0, max_value=None, unit="%RH", context_scope="general",
        interpretation_template="Humidity of {value}%RH creates high mold risk per RESET.",
        business_impact_template="Humidity above 70% RH creates significant allergen and virus risk.",
        recommendation_template="Immediate dehumidification. Inspect for water damage.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_hum_c, index_weight_percent=15.0,
        reference_source_id=sources["RESET"].id,
    )

    # Temperature: GOOD 20-24, WATCH LOW 17-20, WATCH HIGH 24-27, CRITICAL <17 or >27
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        threshold_band="GOOD", min_value=20.0, max_value=24.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is within RESET Viral Index baseline.",
        business_impact_template="Temperature within 20-24 deg C minimizes virus survivability per RESET.",
        recommendation_template="No action required.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_temp_g, index_weight_percent=10.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        threshold_band="WATCH", min_value=17.0, max_value=20.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is below RESET baseline (17-20 deg C).",
        business_impact_template="Temperature below 20 deg C affects virus survivability per RESET.",
        recommendation_template="Increase heating to reach 20-24 deg C optimal range.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_temp_wl, index_weight_percent=10.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="range",
        threshold_band="WATCH", min_value=24.0, max_value=27.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is above RESET baseline (24-27 deg C).",
        business_impact_template="Temperature above 24 deg C affects virus survivability per RESET.",
        recommendation_template="Increase cooling to reach 20-24 deg C optimal range.",
        priority_logic=Priority.P2, confidence_level=ConfidenceLevel.MEDIUM,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_temp_wh, index_weight_percent=10.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="lower_bound",
        threshold_band="CRITICAL", min_value=None, max_value=17.0, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C is critically low per RESET.",
        business_impact_template="Temperature below 17 deg C significantly increases virus survivability.",
        recommendation_template="Emergency heating required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_temp_c, index_weight_percent=10.0,
        reference_source_id=sources["RESET"].id,
    )
    upsert_rule(session, metric_name=MetricName.temperature_c, threshold_type="upper_bound",
        threshold_band="CRITICAL", min_value=27.0, max_value=None, unit="deg C", context_scope="general",
        interpretation_template="Temperature of {value} deg C exceeds safe range per RESET.",
        business_impact_template="Temperature above 27 deg C significantly increases virus survivability.",
        recommendation_template="Emergency cooling required.",
        priority_logic=Priority.P1, confidence_level=ConfidenceLevel.HIGH,
        rule_version=RULE_VERSION, effective_from=EFFECTIVE_FROM, approval_status="approved",
        citation_unit_ids=cit_reset_temp_c, index_weight_percent=10.0,
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
        # Breakdown by metric and band
        src_rules = [r for r in all_rules if r.reference_source_id == src.id]
        metrics = set(r.metric_name.value for r in src_rules)
        for metric in sorted(metrics):
            m_rules = [r for r in src_rules if r.metric_name.value == metric]
            bands = {r.threshold_band or "(none)": len([x for x in m_rules if x.threshold_band == r.threshold_band]) for r in m_rules}
            print(f"      {metric}: {bands}")
    print("=" * 60)


if __name__ == "__main__":
    main()
