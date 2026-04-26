# Phase 1: DB-Backed Rulebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the rule engine to query `rulebook_entry` from the database instead of hardcoded `_DEFAULT_RULES`, populate the DB with initial rules, and add a seed script.

**Architecture:** The rule engine (`rule_engine.py`) gains a `fetch_rules_from_db(session)` function that queries `rulebook_entry` table. `_DEFAULT_RULES` is kept as a fallback. A seed script populates initial rules. The upload route uses the DB-backed rules with a proper `rule_version`.

**Tech Stack:** FastAPI, SQLModel, Supabase PostgreSQL, pytest, Recharts (frontend — already has TimeSeriesChart)

**Key context:**

- The frontend ops page (`/ops`) already has `TimeSeriesChart`, `FindingsSummaryBar`, `ZoneToggle`, `MetricToggle`, `ActionList`, `FindingDetailDialog` — no new frontend components needed
- The readings endpoint (`GET /api/uploads/{id}/readings`) already exists in `dashboard.py`
- The rulebook API routes (`/api/rulebook/*`) already exist and return DB data — they just need data
- The wellness index in `aggregation.py` already queries `rulebook_entry.index_weight_percent` — currently returns empty dict

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `backend/app/services/db_rule_service.py` | **Create** | DB-backed rule fetching + RulebookEntry → RuleDefinition conversion |
| `backend/app/skills/iaq_rule_governor/rule_engine.py` | **Modify** | Wire `evaluate_readings` to fetch rules from DB (with `_DEFAULT_RULES` fallback) |
| `backend/app/api/routers/uploads.py` | **Modify** | Update `_DEFAULT_RULE_VERSION` to "v1.0" to match seeded DB rules |
| `scripts/seed_rulebook_v1.py` | **Create** | Standalone seed script — populates `reference_source`, `citation_unit`, `rulebook_entry` from the current 20 `_DEFAULT_RULES` |
| `backend/tests/unit/test_db_rule_service.py` | **Create** | Unit tests for DB rule service |
| `backend/tests/unit/test_rule_engine.py` | **Modify** | Add determinism test for DB-backed rule evaluation |
| `backend/tests/integration/test_upload_pipeline.py` | **Modify** | Test full pipeline with DB-backed rules |

---

### Task 1: Create DB Rule Service

**Files:**

- Create: `backend/app/services/db_rule_service.py`
- Create: `backend/tests/unit/test_db_rule_service.py`

- [ ] **Step 1: Write tests for the DB rule service**

Create `backend/tests/unit/test_db_rule_service.py`:

```python
"""
backend/tests/unit/test_db_rule_service.py

Unit tests for the DB-backed rule service.
Tests the RulebookEntry → RuleDefinition conversion and fetch logic.
"""

import pytest
from datetime import datetime, timezone
from sqlmodel import Session

from app.services.db_rule_service import (
    entry_to_rule_definition,
    fetch_rules_from_db,
    get_latest_approved_version,
)
from app.models.workflow_a import RulebookEntry
from app.models.enums import MetricName, ThresholdBand, ConfidenceLevel


def test_entry_to_rule_definition(db_session):
    """A RulebookEntry with a single band converts to a RuleDefinition."""
    entry = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
        min_value=800.0,
        max_value=1200.0,
        unit="ppm",
        context_scope="general",
        interpretation_template="CO2 is elevated.",
        business_impact_template="Cognitive decline expected.",
        recommendation_template="Increase ventilation.",
        priority_logic="P2",
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
    assert rule.band == ThresholdBand.WATCH
    assert rule.min_value == 800.0
    assert rule.max_value == 1200.0
    assert rule.rule_id == "R-CO2-WATCH"


def test_entry_to_rule_definition_good_band(db_session):
    """A GOOD band entry converts correctly."""
    entry = RulebookEntry(
        metric_name=MetricName.pm25_ugm3,
        threshold_type="upper_bound",
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
        citation_unit_ids="CIT-PM25-001",
        index_weight_percent=25.0,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    rule = entry_to_rule_definition(entry)

    assert rule.band == ThresholdBand.GOOD
    assert rule.rule_id == "R-PM25-GOOD"


def test_entry_to_rule_definition_critical_high(db_session):
    """A CRITICAL band with no max_value converts correctly."""
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


def test_fetch_rules_from_db_returns_approved_only(db_session):
    """fetch_rules_from_db returns only approved entries."""
    # Approved entry
    approved = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
        min_value=300.0,
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

    # Draft entry (should be excluded)
    draft = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
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
    assert rules[0].rule_id == "R-CO2-GOOD"


def test_fetch_rules_from_db_empty_when_no_rules(db_session):
    """fetch_rules_from_db returns empty list when no rules exist."""
    rules = fetch_rules_from_db(db_session, "v1.0")
    assert len(rules) == 0


def test_get_latest_approved_version(db_session):
    """get_latest_approved_version returns the latest rule_version with approved entries."""
    entry = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
        min_value=300.0,
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
    version = get_latest_approved_version(db_session)
    assert version is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/unit/test_db_rule_service.py -v
```

Expected: All tests fail (module does not exist)

- [ ] **Step 3: Implement the DB rule service**

Create `backend/app/services/db_rule_service.py`:

```python
"""
backend/app/services/db_rule_service.py

DB-backed rule service.

Fetches active rules from the rulebook_entry table and converts
them to RuleDefinition objects for use by the rule engine.

This replaces the hardcoded _DEFAULT_RULES with database-driven rules
while maintaining the same RuleDefinition interface for backward compatibility.
"""

from sqlmodel import Session, col, select

from app.models.enums import MetricName, ThresholdBand, ConfidenceLevel
from app.models.workflow_a import RulebookEntry
from app.skills.iaq_rule_governor.rule_engine import RuleDefinition


# ── Band inference ────────────────────────────────────────────────────────────

def _infer_band(entry: RulebookEntry) -> ThresholdBand:
    """
    Infer the ThresholdBand from a RulebookEntry's min/max values.

    Heuristic (based on current rule conventions):
    - min_value=0 and max_value is the GOOD upper bound → GOOD
    - min_value > 0 with finite max_value → WATCH
    - max_value is None (unbounded high) → CRITICAL
    - min_value is None (unbounded low) → CRITICAL
    """
    if entry.max_value is None or entry.min_value is None:
        return ThresholdBand.CRITICAL
    if entry.min_value == 0:
        return ThresholdBand.GOOD
    return ThresholdBand.WATCH


def _build_rule_id(metric_name: MetricName, band: ThresholdBand) -> str:
    """
    Build a rule_id from metric name and band.
    e.g., R-CO2-GOOD, R-PM25-WATCH, R-TEMP-CRITICAL-HIGH
    """
    metric_short = {
        MetricName.co2_ppm: "CO2",
        MetricName.pm25_ugm3: "PM25",
        MetricName.tvoc_ppb: "TVOC",
        MetricName.temperature_c: "TEMP",
        MetricName.humidity_rh: "HUM",
    }.get(metric_name, metric_name.value.upper())

    return f"R-{metric_short}-{band.value}"


def entry_to_rule_definition(entry: RulebookEntry) -> RuleDefinition:
    """Convert a RulebookEntry to a RuleDefinition for use by the rule engine."""
    band = _infer_band(entry)
    metric_name = MetricName(entry.metric_name) if isinstance(entry.metric_name, str) else entry.metric_name

    return RuleDefinition(
        metric_name=metric_name,
        band=band,
        min_value=entry.min_value,
        max_value=entry.max_value,
        interpretation_template=entry.interpretation_template,
        workforce_impact_template=entry.business_impact_template,
        recommendation_template=entry.recommendation_template,
        rule_id=_build_rule_id(metric_name, band),
        citation_unit_ids=[cid.strip() for cid in entry.citation_unit_ids.split(",") if cid.strip()],
        confidence_level=entry.confidence_level,
    )


# ── DB fetching ───────────────────────────────────────────────────────────────

def fetch_rules_from_db(session: Session, rule_version: str) -> list[RuleDefinition]:
    """
    Fetch all approved rules for the given rule_version from the database.
    Returns them as RuleDefinition objects compatible with the rule engine.
    """
    entries = session.exec(
        select(RulebookEntry)
        .where(col(RulebookEntry.rule_version) == rule_version)
        .where(col(RulebookEntry.approval_status) == "approved")
    ).all()

    return [entry_to_rule_definition(e) for e in entries]


def get_latest_approved_version(session: Session) -> str | None:
    """
    Return the latest rule_version that has approved entries.
    Returns None if no approved rules exist.
    """
    entries = session.exec(
        select(RulebookEntry.rule_version)
        .where(col(RulebookEntry.approval_status) == "approved")
    ).all()

    if not entries:
        return None

    # Return the lexicographically latest version
    return max(entries)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/unit/test_db_rule_service.py -v
```

Expected: All 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/db_rule_service.py backend/tests/unit/test_db_rule_service.py
git commit -m "feat: add DB-backed rule service with unit tests

- entry_to_rule_definition: converts RulebookEntry to RuleDefinition
- fetch_rules_from_db: queries approved rules by version
- get_latest_approved_version: finds latest active rule version
- Band inference: GOOD/WATCH/CRITICAL from min/max values"
```

---

### Task 2: Wire Rule Engine to DB Rules

**Files:**

- Modify: `backend/app/skills/iaq_rule_governor/rule_engine.py`
- Modify: `backend/tests/unit/test_rule_engine.py`

- [ ] **Step 1: Update `evaluate_readings` to accept a rules parameter**

Modify the `evaluate_readings` function in `rule_engine.py` to accept an optional `rules` parameter. If provided, use it instead of `_DEFAULT_RULES`:

Find the current `evaluate_readings` signature:

```python
def evaluate_readings(
    normalised_rows: list[dict],
    site_id: str,
    upload_id: str,
    rule_version: str,
    context_scope: str = "general",
) -> list["EvaluatedFinding"]:
```

Update it to:

```python
def evaluate_readings(
    normalised_rows: list[dict],
    site_id: str,
    upload_id: str,
    rule_version: str,
    context_scope: str = "general",
    rules: list[RuleDefinition] | None = None,
) -> list["EvaluatedFinding"]:
```

Inside the function, find the line that calls `_find_matching_rule`:

```python
rule = _find_matching_rule(metric_name, value) if metric_name else None
```

Replace it with:

```python
rule = _find_matching_rule(metric_name, value, rules) if metric_name else None
```

- [ ] **Step 2: Update `_find_matching_rule` to accept optional rules list**

Find the current `_find_matching_rule` function:

```python
def _find_matching_rule(
    metric_name: MetricName,
    value: float,
) -> RuleDefinition | None:
    for rule in _DEFAULT_RULES:
        if rule.metric_name != metric_name:
            continue
        min_ok = rule.min_value is None or value >= rule.min_value
        max_ok = rule.max_value is None or value <= rule.max_value
        if min_ok and max_ok:
            return rule
    return None
```

Update it to:

```python
def _find_matching_rule(
    metric_name: MetricName,
    value: float,
    rules: list[RuleDefinition] | None = None,
) -> RuleDefinition | None:
    target_rules = rules if rules is not None else _DEFAULT_RULES
    for rule in target_rules:
        if rule.metric_name != metric_name:
            continue
        min_ok = rule.min_value is None or value >= rule.min_value
        max_ok = rule.max_value is None or value <= rule.max_value
        if min_ok and max_ok:
            return rule
    return None
```

- [ ] **Step 3: Run existing tests to verify no regression**

```bash
cd backend && pytest tests/unit/test_rule_engine.py -v
```

Expected: Existing tests still pass (or skip)

- [ ] **Step 4: Add a test for DB-backed rule evaluation**

Append to `backend/tests/unit/test_rule_engine.py`:

```python
# ── DB-backed rule evaluation ─────────────────────────────────────────────────


def test_rule_evaluation_with_db_rules():
    """
    When rules are passed as a parameter, the engine uses them instead
    of the hardcoded _DEFAULT_RULES.
    """
    from datetime import datetime, timezone
    from app.models.workflow_a import RulebookEntry
    from app.models.enums import ConfidenceLevel

    # Create a minimal DB rule for CO2
    entry = RulebookEntry(
        metric_name=MetricName.co2_ppm,
        threshold_type="upper_bound",
        min_value=300.0,
        max_value=800.0,
        unit="ppm",
        context_scope="general",
        interpretation_template="CO2 level of {value} ppm is acceptable.",
        business_impact_template="Normal cognitive function.",
        recommendation_template="No action.",
        priority_logic="P1",
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids="CIT-CO2-GOOD",
        index_weight_percent=25.0,
    )

    from app.services.db_rule_service import entry_to_rule_definition
    rule = entry_to_rule_definition(entry)

    rows = [
        {
            "zone_name": "Zone A",
            "metric_name": "co2_ppm",
            "metric_value": 500.0,
            "metric_unit": "ppm",
            "is_outlier": False,
        }
    ]

    findings = evaluate_readings(
        rows,
        site_id="test-site",
        upload_id="test-upload",
        rule_version="v1.0",
        rules=[rule],
    )

    assert len(findings) == 1
    assert findings[0].threshold_band == ThresholdBand.GOOD
    assert findings[0].rule_id == "R-CO2-GOOD"
    assert findings[0].rule_version == "v1.0"
```

Also add this import at the top of the test file:

```python
from app.models.enums import MetricName, ThresholdBand
from app.skills.iaq_rule_governor.rule_engine import evaluate_readings
```

- [ ] **Step 5: Run tests to verify**

```bash
cd backend && pytest tests/unit/test_rule_engine.py -v
```

Expected: New test passes, existing tests unchanged

- [ ] **Step 6: Commit**

```bash
git add backend/app/skills/iaq_rule_governor/rule_engine.py backend/tests/unit/test_rule_engine.py
git commit -m "refactor: wire rule engine to accept DB rules parameter

- evaluate_readings accepts optional rules list
- _find_matching_rule uses provided rules or falls back to _DEFAULT_RULES
- Backward compatible: existing callers still work with hardcoded rules"
```

---

### Task 3: Create Seed Script for Rulebook Population

**Files:**

- Create: `scripts/seed_rulebook_v1.py`

- [ ] **Step 1: Create the seed script**

Create `scripts/seed_rulebook_v1.py`:

```python
#!/usr/bin/env python3
"""
scripts/seed_rulebook_v1.py

Seeds the rulebook database with the initial rule set (v1.0).

Populates three tables:
  1. reference_source — WHO AQG 2021, SS 554, ASHRAE, IAQ guidelines
  2. citation_unit — verbatim excerpts linked to each source
  3. rulebook_entry — 20 rules covering CO2, PM2.5, TVOC, Temperature, Humidity
     with GOOD/WATCH/CRITICAL bands and index_weight_percent

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/seed_rulebook_v1.py

Idempotent: Re-running updates existing records, never duplicates.
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
    """Upsert a RulebookEntry by rule_id + rule_version."""
    existing = session.exec(
        select(RulebookEntry).where(
            col(RulebookEntry.rule_id) == kwargs["rule_id"],
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
        rule_id="R-CO2-GOOD",
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
        rule_id="R-CO2-WATCH",
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
        rule_id="R-CO2-CRITICAL",
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
        rule_id="R-PM25-GOOD",
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
        rule_id="R-PM25-WATCH",
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
        rule_id="R-PM25-CRITICAL",
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
        rule_id="R-TVOC-GOOD",
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
        rule_id="R-TVOC-WATCH",
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
        rule_id="R-TVOC-CRITICAL",
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
        rule_id="R-TEMP-GOOD",
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
        rule_id="R-TEMP-WATCH-LOW",
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
        rule_id="R-TEMP-WATCH-HIGH",
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
        rule_id="R-TEMP-CRITICAL-HIGH",
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
        rule_id="R-TEMP-CRITICAL-LOW",
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
        rule_id="R-HUM-GOOD",
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
        rule_id="R-HUM-WATCH-LOW",
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
        rule_id="R-HUM-WATCH-HIGH",
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
        rule_id="R-HUM-CRITICAL-HIGH",
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
        rule_id="R-HUM-CRITICAL-LOW",
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
```

- [ ] **Step 2: Run the seed script against local DB**

```bash
cd backend && source .venv/bin/activate && python ../scripts/seed_rulebook_v1.py
```

Expected output:

```
============================================================
Seeding rulebook v1.0
============================================================
Seeded: 4 sources, 14 citations, 20 rules
============================================================
```

- [ ] **Step 3: Verify via rulebook API**

```bash
# Start the backend
cd backend && fastapi dev app/main.py &
# Then in another terminal:
curl http://localhost:8000/api/rulebook/rules | python -m json.tool | head -50
```

Expected: Returns 20 rules with rule_version "v1.0"

- [ ] **Step 4: Commit**

```bash
git add scripts/seed_rulebook_v1.py
git commit -m "feat: add seed script for rulebook v1.0

- Populates 4 reference sources (WELL, WHO, ASHRAE, IAQ)
- Creates 14 citation units linked to sources
- Seeds 20 rules (CO2, PM2.5, TVOC, Temperature, Humidity)
  with GOOD/WATCH/CRITICAL bands
- Idempotent: re-runs update existing records
- Rule version: v1.0"
```

---

### Task 4: Update Upload Route to Use DB Rules

**Files:**

- Modify: `backend/app/api/routers/uploads.py:40-49, 161-166`
- Test: existing `backend/tests/integration/test_upload_pipeline.py`

- [ ] **Step 1: Update the upload route to fetch rules from DB**

In `backend/app/api/routers/uploads.py`, find the top-level constants:

```python
_DEFAULT_RULE_VERSION = "v1"

_DEFAULT_RULEBOOK_WEIGHTS: dict[str, float] = {
    "co2_ppm": 25.0,
    "pm25_ugm3": 25.0,
    "tvoc_ppb": 20.0,
    "temperature_c": 15.0,
    "humidity_rh": 15.0,
}
```

Replace with:

```python
_DEFAULT_RULE_VERSION = "v1.0"
```

(Keep only the version constant — the weights will come from the DB via aggregation.py)

- [ ] **Step 2: Add DB rule fetching to the upload flow**

Add this import at the top:

```python
from app.services.db_rule_service import fetch_rules_from_db
```

Find the rule evaluation section (around line 160-166):

```python
    # Evaluate readings against rulebook to generate findings
    eval_findings = evaluate_readings(
        parse_result.normalised_rows,
        site_id=site_id,
        upload_id=upload_id,
        rule_version=_DEFAULT_RULE_VERSION,
    )
```

Replace with:

```python
    # Evaluate readings against rulebook to generate findings
    # Fetch rules from DB; fall back to hardcoded rules if DB is empty
    db_rules = fetch_rules_from_db(session, _DEFAULT_RULE_VERSION)
    eval_findings = evaluate_readings(
        parse_result.normalised_rows,
        site_id=site_id,
        upload_id=upload_id,
        rule_version=_DEFAULT_RULE_VERSION,
        rules=db_rules if db_rules else None,
    )
```

- [ ] **Step 3: Run existing integration tests**

```bash
cd backend && pytest tests/integration/test_upload_pipeline.py -v
```

Expected: Tests pass (the fallback to _DEFAULT_RULES ensures no breakage)

- [ ] **Step 4: Manual end-to-end test**

```bash
# 1. Seed the DB
cd backend && source .venv/bin/activate && python ../scripts/seed_rulebook_v1.py

# 2. Start backend
cd backend && fastapi dev app/main.py &

# 3. Upload a sample CSV
curl -X POST http://localhost:8000/api/uploads \
  -F "file=@assets/sample_uploads/npe_sample.csv" \
  -F "site_id=test-site"
```

Expected: Upload succeeds, `finding_count` > 0, `wellness_score` is calculated

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routers/uploads.py
git commit -m "feat: wire upload route to DB-backed rules

- Rule version updated to v1.0 to match seed script
- Fetches rules from rulebook_entry table before evaluation
- Falls back to _DEFAULT_RULES if DB is empty
- Keeps hardcoded weights as interim (will be replaced by DB weights)"
```

---

### Task 5: End-to-End Integration Test

**Files:**

- Modify: `backend/tests/integration/test_upload_pipeline.py`

- [ ] **Step 1: Add end-to-end test for DB-backed rule evaluation**

Add to `backend/tests/integration/test_upload_pipeline.py`:

```python
# ── DB-backed rule pipeline ───────────────────────────────────────────────────


def test_upload_with_db_rules(client, db_session):
    """
    End-to-end test: seed DB rules, upload CSV, verify findings
    reference the seeded rule_version and citation_unit_ids.
    """
    from datetime import datetime, timezone
    from io import BytesIO

    # Seed minimal rules for testing
    from app.models.workflow_a import ReferenceSource, CitationUnit, RulebookEntry
    from app.models.enums import ConfidenceLevel, Priority, SourceCurrency

    source = ReferenceSource(
        title="Test Standard",
        publisher="Test",
        source_type="standard",
        jurisdiction="SG",
        version_label="1.0",
        published_date=datetime.now(timezone.utc),
        effective_date=datetime.now(timezone.utc),
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED,
    )
    db_session.add(source)
    db_session.flush()

    citation = CitationUnit(
        source_id=source.id,
        page_or_section="Test Section",
        exact_excerpt="CO2 should be below 800 ppm",
        metric_tags='["co2_ppm"]',
        condition_tags='["general"]',
    )
    db_session.add(citation)
    db_session.flush()

    # Add a GOOD rule for CO2
    rule = RulebookEntry(
        metric_name="co2_ppm",
        threshold_type="range",
        min_value=300.0,
        max_value=800.0,
        unit="ppm",
        context_scope="general",
        interpretation_template="CO2 of {value} ppm is good.",
        business_impact_template="Normal.",
        recommendation_template="No action.",
        priority_logic=Priority.P1,
        confidence_level=ConfidenceLevel.HIGH,
        rule_version="v1.0",
        effective_from=datetime.now(timezone.utc),
        approval_status="approved",
        citation_unit_ids=citation.id,
        rule_id="R-CO2-GOOD",
        index_weight_percent=25.0,
    )
    db_session.add(rule)
    db_session.commit()

    # Create a minimal CSV upload
    import uuid
    from app.models.workflow_b import Site

    site_id = str(uuid.uuid4())
    site = Site(id=site_id, name="Test Site")
    db_session.add(site)
    db_session.commit()

    csv_content = "device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh\nDEV01,2026-04-21T10:00:00,Zone A,500,10,100,22,45\n"

    response = client.post(
        "/api/uploads",
        files={"file": ("test.csv", BytesIO(csv_content.encode()), "text/csv")},
        params={"site_id": site_id},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["upload_id"] is not None
    assert data["finding_count"] > 0

    # Verify findings reference the seeded rule version
    upload_id = data["upload_id"]
    findings_resp = client.get(f"/api/uploads/{upload_id}/findings")
    assert findings_resp.status_code == 200
    findings = findings_resp.json()

    # At least one finding should reference v1.0
    co2_findings = [f for f in findings if f["metric_name"] == "co2_ppm"]
    assert len(co2_findings) > 0
    assert co2_findings[0]["rule_version"] == "v1.0"


def test_upload_falls_back_to_embedded_rules_when_db_empty(client, db_session):
    """
    When the DB has no rules for the target version, the upload
    should still succeed using the embedded _DEFAULT_RULES.
    """
    import uuid
    from io import BytesIO
    from app.models.workflow_b import Site

    site_id = str(uuid.uuid4())
    site = Site(id=site_id, name="Test Site")
    db_session.add(site)
    db_session.commit()

    csv_content = "device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh\nDEV01,2026-04-21T10:00:00,Zone A,500,10,100,22,45\n"

    response = client.post(
        "/api/uploads",
        files={"file": ("test.csv", BytesIO(csv_content.encode()), "text/csv")},
        params={"site_id": site_id},
    )

    # Should succeed using fallback rules
    assert response.status_code == 200
    data = response.json()
    assert data["finding_count"] > 0
    assert data["wellness_score"] > 0
```

- [ ] **Step 2: Run all integration tests**

```bash
cd backend && pytest tests/integration/ -v
```

Expected: All integration tests pass

- [ ] **Step 3: Run full test suite**

```bash
cd backend && pytest -v
```

Expected: All tests pass (including new ones)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/test_upload_pipeline.py
git commit -m "test: add end-to-end tests for DB-backed rule pipeline

- test_upload_with_db_rules: seeds DB rules, uploads CSV, verifies findings
- test_upload_falls_back_to_embedded_rules_when_db_empty: fallback test
- Ensures rule_version matches seeded v1.0 in findings"
```

---

## Post-Plan Verification

After all tasks are complete, verify:

1. **Seed script works:**

   ```bash
   cd backend && python ../scripts/seed_rulebook_v1.py
   ```

   Should report: 4 sources, 14 citations, 20 rules

2. **Rulebook API returns data:**

   ```bash
   curl http://localhost:8000/api/rulebook/rules | jq 'length'
   ```

   Should return: 20

3. **Upload uses DB rules:**

   ```bash
   curl -X POST http://localhost:8000/api/uploads \
     -F "file=@assets/sample_uploads/npe_sample.csv" \
     -F "site_id=<any-site-id>"
   ```

   Should return findings with `rule_version: "v1.0"`

4. **All tests pass:**

   ```bash
   cd backend && pytest -v
   ```

5. **Wellness Index now uses DB weights** (aggregation.py queries `rulebook_entry.index_weight_percent` — will return valid weights after seeding)
