# Phase 1 Design: DB-Backed Rulebook & Scan-to-Report

**Date:** 2026-04-21
**Status:** Draft
**Owner:** Jeff
**Approver:** Jeff / Jay (for standard priority decisions)

---

## 1. Objective

Connect the existing rulebook database infrastructure to the rule engine so that certification thresholds come from the database (not hardcoded), enabling full traceability from findings back to specific standard clauses (SS 554, WHO AQG 2021, etc.). Add sparkline time series charts to the Operations findings view.

---

## 2. Architecture

```
CSV Upload → Parse (csv_parser.py) → Readings stored in DB
                                          │
                                          ▼
                                   Rule Engine queries
                                   rulebook_entry table
                                          │
                                          ▼
                                  Findings stored in DB
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │  Report Generation    │
                               │  JSON snapshot → DB   │
                               │  PDF export on-demand │
                               └──────────────────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │  Executive Dashboard  │
                               │  Wellness Index       │
                               │  (DB-sourced weights) │
                               └──────────────────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │  Operations View      │
                               │  Findings + Sparklines│
                               │  Report PDF Export    │
                               └──────────────────────┘
```

### Key Design Principles

- Database is the single source of truth for certification thresholds
- Each finding traces back to specific standard clauses via `citation_unit_ids`
- Multi-standard reports supported (SS 554 for CO2, WHO for PM2.5, etc.)
- Sparkline charts added to Operations findings tab (single upload scope)

---

## 3. Rulebook Population

### 3.1 Source Standards

Three curated standards exist in `assets/standards/curated/`:

| Standard | Metrics Covered | Role |
| --- | --- | --- |
| SS 554:2016 Amdt 1:2021 | CO2, PM2.5, Temperature, Humidity | Singapore mandatory IAQ standard |
| WHO AQG 2021 | PM2.5, TVOC | Global health guidelines |
| Green Mark 2021 HW | TBD | Green building certification |

### 3.2 Standard Priority (Pending Jay's Approval)

When multiple standards cover the same metric (e.g., PM2.5 in both SS 554 and WHO), Jay decides which takes priority for certification decisions. The non-primary standard can remain as advisory context.

**Decision needed:** Which standard governs which metric?

### 3.3 Seed Script

The existing `scripts/seed_rulebook.py` gets updated to:

1. Read merged curated JSONs (after standard priority resolved)
2. Upsert `reference_source` table — one row per standard
3. Upsert `citation_unit` table — verbatim excerpts with metric/condition tags
4. Upsert `rulebook_entry` table — runtime threshold definitions with:
   - `rule_version`: semantic version (e.g., "v1.0-ss554-who-merged")
   - `index_weight_percent`: Wellness Index weight per metric
   - `approval_status`: "approved"
   - `effective_from`: current date

### 3.4 Curated JSON Schema

Each curated JSON must contain rules with the following structure:

```json
{
  "source": { "title", "publisher", "source_type", "jurisdiction", "version_label", "effective_date", "source_currency_status" },
  "rules": [{
    "citation": { "page_or_section", "exact_excerpt", "metric_tags", "condition_tags", "extracted_threshold_value", "extracted_unit" },
    "rule": { "metric_name", "threshold_type", "min_value", "max_value", "unit", "context_scope", "interpretation_template", "business_impact_template", "recommendation_template", "priority_logic", "index_weight_percent", "confidence_level" }
  }]
}
```

### 3.5 Gap: GOOD/WATCH/CRITICAL Bands

The curated JSONs contain single threshold values (e.g., CO2 ≤ 1000 ppm), but the rule engine needs GOOD/WATCH/CRITICAL bands. The seed script or curated JSONs must be updated to include all three bands per metric.

**Example — CO2:**

- GOOD: < 800 ppm
- WATCH: 800–1000 ppm
- CRITICAL: > 1000 ppm

These bands should be derived from the standard where possible, or added as project-specific interpretation with Jay's approval.

---

## 4. Rule Engine Wiring

### 4.1 Current State

`rule_engine.py` iterates over hardcoded `_DEFAULT_RULES` (list of `RuleDefinition` dataclasses). Matching logic: first match wins, GOOD → WATCH → CRITICAL order.

### 4.2 Target State

`rule_engine.py` queries `rulebook_entry` table at upload time:

```python
def _fetch_rules_from_db(session, rule_version: str) -> list[RuleDefinition]:
    """Fetch active rules from rulebook_entry table."""
    entries = session.exec(
        select(RulebookEntry)
        .where(col(RulebookEntry.rule_version) == rule_version)
        .where(col(RulebookEntry.approval_status) == "approved")
    ).all()
    return [entry_to_rule_definition(e) for e in entries]
```

The matching logic (`_find_matching_rule`) remains unchanged — only the data source changes from hardcoded to DB.

### 4.3 Migration Considerations

- Existing findings carry old `rule_version` strings (e.g., "R-CO2-GOOD")
- New findings will carry the DB-traceable `rule_version` (e.g., "v1.0-ss554-who-merged")
- Old findings remain valid — no migration needed
- The `_DEFAULT_RULES` constant is kept as a fallback during the transition period

### 4.4 Wellness Index

`aggregation.py` already queries `rulebook_entry.index_weight_percent` — this will start working correctly once the DB is populated. No code changes needed.

### 4.5 Rulebook API

`/api/rulebook/*` routes already exist and return DB data — they will start returning actual results once the seed script runs. No code changes needed.

---

## 5. Operations View: Sparkline Charts

### 5.1 Scope

Sparkline time series charts added to the Operations findings tab, showing metric values across the current upload period.

### 5.2 Data Source

Backend: New endpoint or extended existing endpoint returning readings grouped by `upload_id` + `metric_name` + `reading_timestamp`:

```
GET /api/uploads/{id}/readings/timeseries
Returns: { metric_name: [{ timestamp, value }] }
```

### 5.3 Frontend Component

- Lightweight SVG or Recharts `LineChart` component
- Embedded in each findings table row
- Single upload scope (not cross-historical)
- Color-coded by threshold band (green = GOOD, amber = WATCH, red = CRITICAL)

### 5.4 Deferred to Phase 2

- Full time series monitoring view with date range picker
- Cross-upload historical trends
- uHoo live API integration

---

## 6. Phase Summary

| Component | Current State | After Phase 1 |
| --- | --- | --- |
| Rule source | Hardcoded `_DEFAULT_RULES` | `rulebook_entry` DB table |
| Standards | Embedded, WELL-inspired | SS 554, WHO, Green Mark from curated JSONs |
| Wellness Index weights | Queries empty DB | Populated from `index_weight_percent` |
| Rulebook API | Returns empty arrays | Returns actual rule data |
| Findings table | Text only | + Sparkline time series charts |
| Report traceability | `citation_unit_ids` (synthetic) | `citation_unit_ids` (real DB references) |

---

## 7. Open Decisions

| # | Decision | Owner | Impact |
| --- | --- | --- | --- |
| 1 | Standard priority per metric (PM2.5: SS 554 vs WHO?) | Jay | Determines which thresholds are certification-grade |
| 2 | GOOD/WATCH/CRITICAL band boundaries for each metric | Jay + Jeff | Curated JSONs or seed script needs all three bands |
| 3 | Rule version naming convention | Jeff | e.g., "v1.0-ss554-who-merged" |
| 4 | uHoo API discovery scope for Phase 2 | Jeff | Deferred, but worth early investigation |

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Threshold mismatch between embedded and curated rules breaks existing findings | Keep `_DEFAULT_RULES` as fallback during transition; test with sample datasets |
| Curated JSONs incomplete (missing bands for some metrics) | Populate bands from embedded rules as interim values, flag for Jay review |
| Seed script fails on Supabase | Test against local PostgreSQL first; seed script is idempotent |
