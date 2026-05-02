# Decision Record: CSV Ingestion, Rule Evaluation, and Pending Metric Expansion

**Date:** 2026-04-21
**Status:** Draft — awaiting Jay's decisions on §4

---

## 1. Workflow: Upload → Parse → Evaluate → Persist

### Pipeline Overview

```text
CSV Upload (POST /api/uploads)
    │
    ├─ 1. Validate file type (.csv)
    ├─ 2. Auto-create site if missing
    ├─ 3. Create Upload record (PENDING)
    ├─ 4. Upload raw CSV to Supabase Storage (iaq-scans bucket)
    ├─ 5. Parse CSV (csv_parser.py)
    │     ├─ Read into pandas DataFrame
    │     ├─ Normalize column headers via COLUMN_ALIASES
    │     ├─ Fill missing sensor data with 0
    │     ├─ Validate required metadata + sensor columns
    │     ├─ Parse timestamps (ISO 8601 / UK DD/MM/YY)
    │     ├─ Detect outliers against OUTLIER_BOUNDS
    │     ├─ Normalize to long format (one row per metric per timestamp)
    │     └─ Auto-detect report type (single day = ASSESSMENT, multi-day = INTERVENTION_IMPACT)
    │
    ├─ 6. Persist readings to `reading` table
    ├─ 7. Evaluate readings against rulebook (rule_engine.py)
    │     ├─ Match each reading to a RuleDefinition by metric + value range
    │     ├─ Fill template strings with actual values
    │     ├─ Flag outliers with LOW confidence
    │     └─ Create "Insufficient Evidence" finding if no rule matches
    │
    ├─ 8. Persist findings to `finding` table
    ├─ 9. Calculate Wellness Index + certification outcome
    └─ 10. Return upload summary (upload_id, finding_count, wellness_score, etc.)
```

### Key Files

| File | Role |
| --- | --- |
| `backend/app/api/routers/uploads.py` | Entry point — orchestrates the full pipeline |
| `backend/app/skills/data_ingestion/csv_parser.py` | CSV parsing, column normalization, outlier detection |
| `backend/app/skills/iaq_rule_governor/rule_engine.py` | Rule evaluation — maps readings to threshold bands |
| `backend/app/models/enums.py` | Shared enums: MetricName, ThresholdBand, ParseOutcome, etc. |
| `backend/app/models/workflow_b.py` | SQLModel ORM definitions for reading, finding, upload, report |

---

## 2. CSV ↔ Database Mapping

### 2.1 CSV Column → Internal Metric Name

The parser maps uHoo export headers to internal standard names via `COLUMN_ALIASES`. Two categories exist:

#### Category A: Direct Standard Headers (no aliasing needed)

These match the canonical NPE table header format:

| CSV Header | Internal Name | DB `metric_name` | Unit |
| --- | --- | --- | --- |
| `device_id` | device_id | (metadata) | — |
| `timestamp` | timestamp | (metadata) | — |
| `zone_name` | zone_name | (metadata) | — |
| `co2_ppm` | co2_ppm | co2_ppm | ppm |
| `co_ppb` | co_ppb | co_ppb | ppb |
| `pm2_5_ugm3` | pm2_5_ugm3 → pm25_ugm3 | pm25_ugm3 | μg/m³ |
| `humidity_rh` | humidity_rh | humidity_rh | %RH |
| `temperature_c` | temperature_c | temperature_c | °C |
| `tvoc_ppb` | tvoc_ppb | tvoc_ppb | ppb |
| `o3_ppb` | o3_ppb | o3_ppb | ppb |
| `no_ppb` | no_ppb | no_ppb | ppb |
| `no2_ppb` | no2_ppb | no2_ppb | ppb |
| `voc_ppb` | voc_ppb | voc_ppb | ppb |
| `pressure_hpa` | pressure_hpa | pressure_hpa | hPa |
| `noise_dba` | noise_dba | noise_dba | dBA |
| `pm10_ugm3` | pm10_ugm3 | pm10_ugm3 | μg/m³ |
| `aqi_index` | aqi_index | aqi_index | AQI |

#### Category B: Alternate uHoo Export Headers (aliased)

These are how the physical uHoo device exports the same metrics:

| uHoo Export Header | Maps To | Notes |
| --- | --- | --- |
| `Sampling Location` | zone_name | Metadata |
| `Date and Time` | timestamp | Metadata |
| `CO2` | co2_ppm | |
| `CO` | co_ppb | |
| `PM2.5` | pm2_5_ugm3 | Note the dot in CSV header |
| `Humidity` | humidity_rh | |
| `Relative Humidity` | humidity_rh | Added 2026-04-21 (UAT fix) |
| `Temperature` | temperature_c | |
| `TVOC` | tvoc_ppb | |
| `O3` | o3_ppb | |
| `Ozone` | o3_ppb | Added 2026-04-21 (UAT fix) |
| `NO` | no_ppb | |
| `NO2` | no2_ppb | |
| `VOC` | voc_ppb | |
| `PRS` | pressure_hpa | |
| `Air Pressure` | pressure_hpa | Added 2026-04-21 (UAT fix) |
| `Noise Level` | noise_dba | |
| `Noise_Level` | noise_dba | |
| `Sound` | noise_dba | Added 2026-04-21 (UAT fix) |
| `PM10` | pm10_ugm3 | |
| `Air Quality Index` | aqi_index | |
| `AQI` | aqi_index | |

### 2.2 Normalized Row → Database Reading

Each CSV row is exploded into N reading rows (one per sensor metric present):

| Normalized Row Field | DB Column | Table |
| --- | --- | --- |
| `device_id` | device_id | reading |
| `zone_name` | zone_name | reading |
| `reading_timestamp` | reading_timestamp | reading |
| `site_id` | site_id | reading |
| `upload_id` | upload_id | reading |
| `metric_name` | metric_name | reading |
| `metric_value` | metric_value | reading |
| `metric_unit` | metric_unit | reading |
| `is_outlier` | is_outlier | reading |

### 2.3 Evaluated Finding → Database Finding

| EvaluatedFinding Field | DB Column | Table |
| --- | --- | --- |
| zone_name | zone_name | finding |
| metric_name | metric_name | finding |
| metric_value | metric_value | finding |
| threshold_band | threshold_band | finding |
| interpretation_text | interpretation_text | finding |
| workforce_impact_text | workforce_impact_text | finding |
| recommended_action | recommended_action | finding |
| rule_id | rule_id | finding |
| rule_version | rule_version | finding |
| citation_unit_ids (list) | citation_unit_ids (JSON string) | finding |
| confidence_level | confidence_level | finding |
| source_currency_status | source_currency_status | finding |
| benchmark_lane | benchmark_lane | finding |

### 2.4 Currently Unsupported CSV Columns

The following uHoo export columns are **silently dropped** — they have no alias, no enum entry, and no rule definitions:

| uHoo Export Header | Decision Needed |
| --- | --- |
| PM1 | Units? Thresholds? Rule source? |
| PM4 | Units? Thresholds? Rule source? |
| Formaldehyde | Units? Thresholds? Rule source? |
| Light | Units? Thresholds? Rule source? |
| Virus Index | Units? Thresholds? Rule source? |
| Mold Index | Units? Thresholds? Rule source? |

---

## 3. Rulebook Workflow

### 3.1 Phase 1: Embedded Rules (Current)

Rules are hardcoded in `rule_engine.py` as `_DEFAULT_RULES`. Each `RuleDefinition` contains:

- **metric_name**: Which metric this rule applies to (from `MetricName` enum)
- **band**: GOOD / WATCH / CRITICAL (from `ThresholdBand` enum)
- **min_value / max_value**: Threshold range boundaries
- **Templates**: interpretation, workforce_impact, recommendation (with `{value}` placeholder)
- **rule_id**: Identifier like `R-CO2-GOOD`, `R-PM25-CRITICAL`
- **citation_unit_ids**: Links to external standards (e.g. `CIT-WELL-001`, `CIT-WHO-001`)
- **confidence_level**: HIGH / MEDIUM / LOW

#### Current Rule Coverage (10 of 14 metrics)

| Metric | Rules | Source |
| --- | --- | --- |
| co2_ppm | GOOD / WATCH / CRITICAL | WELL / WHO |
| pm25_ugm3 | GOOD / WATCH / CRITICAL | WHO |
| tvoc_ppb | GOOD / WATCH / CRITICAL | IAQ guidelines |
| temperature_c | GOOD / WATCH-LOW / WATCH-HIGH / CRITICAL-HIGH / CRITICAL-LOW | ASHRAE |
| humidity_rh | GOOD / WATCH-LOW / WATCH-HIGH / CRITICAL-HIGH / CRITICAL-LOW | ASHRAE |

#### Metrics With No Rules (produce R-INSUFFICIENT findings)

| Metric | Status |
| --- | --- |
| co_ppb | No rule → Insufficient Evidence |
| o3_ppb | No rule → Insufficient Evidence |
| no_ppb | No rule → Insufficient Evidence |
| no2_ppb | No rule → Insufficient Evidence |
| voc_ppb | No rule → Insufficient Evidence |
| pressure_hpa | No rule → Insufficient Evidence |
| noise_dba | No rule → Insufficient Evidence |
| pm10_ugm3 | No rule → Insufficient Evidence |
| aqi_index | No rule → Insufficient Evidence |

### 3.2 Phase 3: Database-Driven Rules (Future)

The embedded rules will be replaced by live `rulebook_entry` queries from the database. The governance workflow:

```text
reference_source (WHO AQG 2021, SS 554, etc.)
    │
    ▼
citation_unit (individual clauses, verbatim excerpts)
    │
    ▼
rulebook_entry (runtime threshold definitions)
    │
    ▼  (SELECT-only by dashboard)
rule_engine.py evaluates readings against entries
```

Key constraints:

- Dashboard has SELECT-only access to rulebook tables
- Writes must use `ADMIN_DATABASE_URL`
- No rule can exist without at least one linked `citation_unit`
- Superseded rules get `effective_to` date + new entry with incremented `rule_version`
- Only `CURRENT_VERIFIED` sources can drive certification decisions

### 3.3 Rule Matching Logic

`_find_matching_rule(metric_name, value)` iterates through `_DEFAULT_RULES` in order (GOOD → WATCH → CRITICAL). First match wins:

```python
min_ok = rule.min_value is None or value >= rule.min_value
max_ok = rule.max_value is None or value <= rule.max_value
if min_ok and max_ok:
    return rule
```

Boundary values belong to the higher band (e.g., CO2 = 800 → WATCH, not GOOD).

---

## 4. Decisions to Be Made

### 4.5 Multi-Standard Rule Composition (Pending Jay's Approval)

Three curated standards exist in `assets/standards/curated/`:

| Standard | Metrics | Status |
| --- | --- | --- |
| SS 554:2016 Amdt 1:2021 | CO2, PM2.5, Temperature, Humidity | CURRENT_VERIFIED |
| WHO AQG 2021 | PM2.5, TVOC | CURRENT_VERIFIED |
| Green Mark 2021 HW | TBD | Needs review |

The embedded rules currently cover CO2, PM2.5, TVOC, Temperature, Humidity — but thresholds differ from the curated JSONs. Example: SS 554 says CO2 ≤ 1000 ppm, embedded says GOOD < 800, WATCH < 1200.

**Question for Jay:** When multiple standards cover the same metric (e.g. PM2.5 in both SS 554 and WHO), which standard takes priority for certification decisions? Should we compose a composite rule set (SS 554 for CO2/Temp/Humidity, WHO for PM2.5, etc.) and disclose the standard source per metric in the generated report for transparency?

**Preferred approach (Jeff):** Option B — refine/merge curated JSONs into a single coherent rule set, then populate the database. Reports should reference which certification standard was used per metric for customer transparency.

**Impact on report generation:** Each finding already carries `citation_unit_ids` and `source_currency_status`. If we merge standards, the report can show "CO2 evaluated against SS 554" and "PM2.5 evaluated against WHO AQG 2021" per finding. This is architecturally supported but needs Jay's sign-off on which standard governs which metric.

### 4.1 New Metric Support (Pending Jay's Approval)

Six uHoo export columns are currently silently dropped. For each, Jay needs to decide:

| Metric | Questions |
| --- | --- |
| **PM1** | Units (μg/m³)? Outlier bounds? WHO/SS554 threshold exists? |
| **PM4** | Units (μg/m³)? Outlier bounds? WHO/SS554 threshold exists? |
| **Formaldehyde** | Units (ppb or mg/m³)? Outlier bounds? WHO guideline? |
| **Light** | Units (lux)? Is this an IAQ metric or environmental comfort? |
| **Virus Index** | Proprietary uHoo metric — what scale? Any regulatory basis? |
| **Mold Index** | Proprietary uHoo metric — what scale? Any regulatory basis? |

#### If Approved: Per-Metric Work

Each new metric requires updates to **6 files**:

1. **enums.py** — Add to `MetricName` enum
2. **csv_parser.py** — Add to `SENSOR_COLUMNS`, `COLUMN_ALIASES`, `OUTLIER_BOUNDS`, `METRIC_MAP`
3. **rule_engine.py** — Add `RuleDefinition` entries (GOOD/WATCH/CRITICAL bands) if thresholds exist
4. **MetricConfig.ts** — Add frontend thresholds, color, display label
5. **MetricToggle.tsx** — Ensure toggle picks up new metric config
6. **aggregation.py** — Add to `_DEFAULT_RULEBOOK_WEIGHTS` if included in Wellness Index

#### Decision Inputs Needed

- WHO AQG 2021 or SS 554 coverage for PM1, PM4, Formaldehyde
- uHoo vendor documentation for Virus Index and Mold Index scales
- Whether Light is in scope for IAQ reporting or should remain excluded

### 4.2 Existing Metrics Without Rules

Nine metrics parse correctly but have no rule definitions, producing `R-INSUFFICIENT` findings. Questions:

- Should CO, O3, NO, NO2, VOC have rules? These are common IAQ metrics with established guidelines.
- Should PM10 have rules? WHO has PM10 guidelines.
- Should Pressure, Noise, AQI have rules? These are comfort/summary metrics — may not need threshold bands.

### 4.3 Silent Column Dropping

Currently unrecognized CSV columns are dropped without warning. Options:

- **A (current)**: Silent drop — no warning
- **B**: Log a warning for each unrecognized column
- **C**: Fail the parse if unrecognized columns exceed a threshold

Recommendation: **B** — log warnings so ops team knows data is being dropped, but don't fail the parse.

### 4.4 Missing Data Strategy

Current behavior: missing sensor values are filled with `0` (user requirement: "no data → 0"). This means:

- A missing CO2 reading of `0` will be evaluated as CRITICAL (below 300 ppm lower bound)
- This may produce misleading findings

Alternative: skip rows with missing values entirely, or flag them as `is_outlier=True`. This needs Jay's input on whether `0` filling is acceptable for all metrics or only some.
