# Epic Plan: PR9 - Professional Report Template & Customer Info Capture (Phase 2)

**Status: Planning**
**Created: 2026-04-22**

## 1. Feature/Epic Summary

- **Objective**: Replace the basic table-based assessment report template with a professional IAQ assessment report that includes cover page, per-zone metric analysis with observed ranges, narrative recommendations, and references. Additionally, capture customer information on the upload form so reports include real client details and the data is available for Phase 3 customer management.
- **User Impact**: The generated PDF report becomes a client-facing professional deliverable rather than an internal data dump. Customer info captured at upload time enables future tenant management and executive view enhancements.
- **Dependencies**: PR1-PR8 all complete. Report generation, preview, and approval workflow functional. QA gates passing.

## 2. Complexity & Fit

- **Classification**: Multi-PR (3 sub-tasks across database, frontend upload form, and report template)
- **Rationale**: Changes span 3 independent layers — database schema (new Site fields), frontend UI (upload form with customer info), and backend template (complete rewrite of assessment report). Each sub-PR is independently testable.

## 3. Full-Stack Impact

- **Frontend**: UploadForm.tsx — replace Site ID input with customer information form (6 fields), auto-generate site UUID
- **Backend**: uploads.py route — accept + persist customer info; pdf_orchestrator.py — query readings, compute per-zone stats, merge site info into snapshot context; assessment_report.html — complete rewrite; style.css — new print styles
- **Data**: Add 6 columns to `site` table (migration 006); existing sites remain valid with null values

## 4. PR Roadmap

### PR 9.1: Customer Info Schema & Upload Form

- **Goal**: Extend the Site model with customer information fields and update the upload form to capture them.
- **Scope (in)**:
  - Add 6 fields to Site model: `client_name` (str), `site_address` (str), `premises_type` (str), `contact_person` (str), `specific_event` (str | null), `comparative_analysis` (bool)
  - Alembic migration 006: add columns to `site` table (all nullable for backward compatibility)
  - UploadForm.tsx: replace "Site ID" text input with a "Customer Information" form section containing: Company Name (required), Site Address (required), Premises Type (required, select dropdown with options: Industrial, Office, Retail, School, Healthcare, Other), Contact Person (required), Specific Event/Complaint (optional textarea), Comparative Analysis (optional checkbox)
  - Auto-generate site UUID behind the scenes — user no longer types a site ID
  - Upload route: accept new params as query parameters, populate site fields on creation, update if site exists
- **Scope (out)**: No report template changes, no executive view changes, no customer management UI
- **Key Changes**: `backend/app/models/workflow_b.py` (Site model), `backend/migrations/versions/006_site_customer_info.py` (NEW), `backend/app/api/routers/uploads.py` (create_upload params), `frontend/components/UploadForm.tsx` (form fields)
- **Testing**: Upload CSV with customer info → verify Site record has all fields populated. Upload with existing site ID → verify fields updated. Upload without optional fields → verify nulls accepted.
- **Dependencies**: None — purely additive schema change

### PR 9.2: Readings Aggregation & Snapshot Context

- **Goal**: Extend `build_report_snapshot` to include per-zone metric statistics and site customer info so the report template has all data it needs.
- **Scope (in)**:
  - Add `_compute_readings_context(session, upload_id)` helper in pdf_orchestrator.py that queries all readings and computes:
    - `zone_metric_stats`: `{zone_name: {metric_name: {min, max, avg, count}}}`
    - `zone_time_ranges`: `{zone_name: {start_iso, end_iso, count}}`
    - `all_metrics`: distinct metric names (sorted)
    - `sampling_date`: formatted date string from first reading (e.g., "13 Jan 2026")
  - Query Site model to get customer info fields, merge into snapshot context
  - Add static `references` list to context: Directly Applied Standards (BCA Green Mark 2021, SGBC, RESET Air, WHO, EPA, CDC, Kikkoman) + Supporting Frameworks (OSHA, HSE, ILO, ASHRAE, NEA, MOM, ISO 14001, GRI, IWBI)
  - Add `columns_captured`: formatted list of metric display names
- **Scope (out)**: No template changes yet — this is purely data preparation
- **Key Changes**: `backend/app/services/pdf_orchestrator.py` (new helper function, extended context)
- **Testing**: Call `build_report_snapshot` with real upload → verify zone_metric_stats has correct min/max for known readings, zone_time_ranges match CSV time windows, site info populated
- **Dependencies**: PR 9.1 (Site model must have customer info fields)

### PR 9.3: Professional Report Template

- **Goal**: Rewrite the assessment report template to match the professional IAQ report format.
- **Scope (in)**:
  - Rewrite `backend/templates/assessment_report.html` with the following structure:
    1. **Cover Page**: "Indoor Air Quality Assessment Report" title, client name, reviewer credentials ("Jay Choy, Chief of Defence, The Indoor Generation"), benchmark standards banner (BCA Green Mark 2021, WELL Building Standard v2, SS 554:2016), SAFE-AIR Protocol mention
    2. **Project Details**: Company/Client, Sampling Site address, Premises Type, Sampling Date, Zones list, Benchmark Standard, Specific Event/Complaint (if present), Comparative Analysis status
    3. **Dataset Summary**: "uHoo Aura minute-level" source note. Per-zone: time range (e.g., "POD: 13/1/26 15:49 to 16:32 (44 minutes, 44 records)")
    4. **Executive Summary**: Overall assessment narrative, threshold breach bullets with specifics (e.g., "Temperature: Above the BCA ideal range in both POD and Outside POD"), columns captured list
    5. **Per-Zone Analysis** (lettered sections A, B, C...): Zone header with name + time range. For each metric with data: Observed Range with unit and exceedance note, Benchmark Standard, Analysis & Implications (from finding interpretation_text if band is non-GOOD, else "Within acceptable range"), Recommendations (from finding recommended_action if present)
    6. **Recommendations Summary**: Immediate actions bullet list from critical + watch findings, grouped by zone
    7. **Conclusion**: Synthesized narrative from findings and zone stats
    8. **References**: Directly Applied Standards list + Supporting Frameworks list
    9. **Disclaimer**: FJ SafeSpace liability text (full paragraph)
  - Update `backend/templates/style.css` with professional print styles:
    - Cover page with branding/header border
    - Zone section headers with letter labels (A), (B), (C)
    - Metric subsection blocks with left border indentation
    - Benchmark standard callout blocks
    - Recommendations summary blocks
    - Reference list styling (hanging indent)
    - Page break controls (avoid breaking mid-zone section)
- **Scope (out)**: No changes to intervention_impact_report.html (separate concern), no charts/graphs in PDF (pure text + tables for now)
- **Key Changes**: `backend/templates/assessment_report.html` (full rewrite), `backend/templates/style.css` (add professional styles)
- **Testing**: Generate report → preview HTML → verify all sections present with correct data. Approve → generate PDF → verify A4 formatting, page breaks, typography. Compare against the professional PDF the user shared.
- **Dependencies**: PR 9.2 (snapshot context must have readings aggregation + site info)

## 5. Milestones & Sequence

```text
PR 9.1 (Customer Info Schema & Upload Form)
  -> PR 9.2 (Readings Aggregation & Snapshot Context)
       -> PR 9.3 (Professional Report Template)
```

**Critical Path**: 9.1 -> 9.2 -> 9.3

**Sequence Rationale**:

1. Schema (9.1) is the absolute prerequisite — template needs customer info, upload form needs new fields
2. Data aggregation (9.2) depends on Site model having customer fields; provides all context for the template
3. Template (9.3) is the final layer — it consumes the enriched snapshot context to render the professional report

Each sub-PR is independently testable: 9.1 can be verified by checking DB records, 9.2 by inspecting snapshot context dict, 9.3 by visual inspection of preview/PDF.

## 6. Risks, Trade-offs, and Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **R1: Existing sites without customer info** | Old reports may show blank client fields | Use site name as fallback; mark fields nullable |
| **R2: Reading aggregation performance** | Large uploads (thousands of readings) could slow snapshot build | Query is simple GROUP BY; should be fast. Monitor and add index if needed |
| **R3: WeasyPrint CSS limitations** | Complex layouts may not render correctly in PDF | Use simple table + div layout; avoid flexbox in PDF CSS |
| **R4: Template complexity** | Jinja2 template with per-zone, per-metric nested loops is harder to maintain | Keep template logic simple; use helper functions in pdf_orchestrator.py |

### Trade-offs

| Decision | Rationale |
|----------|-----------|
| **Nullable Site fields** | Backward compatibility with existing data; no migration needed for old sites |
| **Auto-generate site UUID** | Users shouldn't need to know/remember site IDs; reduces friction |
| **No charts in PDF** | Recharts are client-side React components; PDF is HTML-to-PDF via WeasyPrint. Text-based metrics with observed ranges and benchmarks are sufficient for Phase 2 |
| **Intervention Impact template unchanged** | Scope is assessment reports only; intervention template can be updated in a follow-up |

### Open Questions

1. **Q1: Premises Type options** — Should the dropdown be extensible (free-text + preset) or fixed enum? Recommend fixed enum for now, extensible in Phase 3.
2. **Q2: Multiple uploads per site** — If a customer uploads multiple CSVs to the same site, should the customer info form pre-fill from the existing site record? Recommend yes — fetch site details if site ID is known.
3. **Q3: Report cover branding** — Should the cover include FJ SafeSpace logo? Currently text-only. Logo would need to be embedded as base64 in the HTML for WeasyPrint.
