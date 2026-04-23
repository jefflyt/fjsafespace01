# FJ SafeSpace Dashboard — Refactor PSD (PSD-R1)

| Field | Value |
| --- | --- |
| **Document** | FJ SafeSpace Dashboard PSD-R1 v0.1 |
| **Scope** | Real-time human-friendly IAQ wellness dashboard |
| **Date** | 2026-04-23 |
| **Owner** | Jeff |
| **Status** | Draft — pending requirements gathering with Jay Choy |
| **Supersedes** | FJDashboard PSD-02 (compliance/reporting model) |

---

## 1. Product Overview

FJ SafeSpace Dashboard provides a **human-readable, real-time view of indoor air quality** across sites and zones. Unlike the uHoo native dashboard which shows raw metrics only (e.g., "CO₂: 850ppm"), this dashboard translates those numbers into **what they mean for the people inside**:

> **CO₂: 850ppm → "Staff may feel drowsy. Consider opening a window or boosting ventilation."**

The system consumes uHoo sensor data (via CSV upload in Phase 1, live API in Phase 3) and surfaces insights in plain language, colour-coded for urgency.

### Problem

- uHoo's native dashboard shows raw metric trends but no interpretation
- Non-technical stakeholders (facility managers, executives) cannot act on "850ppm CO₂"
- No consolidated view across multiple sites with human-readable risk signals

### Solution

A single dashboard that:
1. **Ingests** IAQ data (CSV batch upload → live API)
2. **Evaluates** against WHO/SS554 thresholds (existing rule engine, preserved)
3. **Translates** findings into human-friendly insights with business impact language
4. **Displays** real-time status cards per site/zone with colour-coded urgency

---

## 2. Target Users

| Persona | Key Needs |
| --- | --- |
| **Jay Choy (Executive / Decision Maker)** | One-page overview of all sites. At-a-glance: which sites are healthy, which need attention, what to do about it. |
| **Analyst / Operations** | Upload data, view site/zone status, see human-readable findings with recommended actions. |
| **Facility Manager (Customer)** | View their site's wellness status, understand what metrics mean for their staff, take corrective action. |

---

## 3. Core MVP Features

### 3.1 Site Overview Card

Per site, display:
- **Site name** and **last updated** timestamp
- **Overall wellness rating** (colour-coded):
  - 🟢 Healthy — all parameters within acceptable range
  - 🟡 Attention Needed — one or more parameters elevated
  - 🔴 Action Required — one or more parameters at concerning levels
- **Top insight** — single most important human-readable finding (e.g., "CO₂ elevated in Meeting Room A — staff may feel drowsy")

### 3.2 Zone Detail View

Per zone within a site:
- **Metric cards** — each metric shows:
  - Current value + unit
  - Colour-coded status (Good / Watch / Concerning)
  - **Human-readable interpretation** (e.g., "Temperature at 28°C — staff may feel restless and lose focus")
  - **Recommended action** (e.g., "Check air conditioning settings")
- **Trend chart** — last 24 hours (or full upload window) showing the metric over time with threshold bands

### 3.3 CSV Upload (Phase 1)

- Upload uHoo CSV export
- Parse → evaluate → display results
- No real-time yet — batch processing on upload

### 3.4 Cross-Site Comparison (Phase 2)

- Leaderboard of sites ranked by overall wellness
- Quick filter: show only sites needing attention

### 3.5 Live API Ingestion (Phase 3)

- Poll uHoo API for real-time readings
- Auto-refresh dashboard cards
- Alert when a metric crosses into "Action Required"

---

## 4. Data Requirements

### Retained from Current System
- **Readings table** — `site_name`, `zone_name`, `device_id`, `reading_timestamp`, `metric_name`, `metric_value`, `metric_unit`
- **Rulebook entries** — thresholds from WHO AQG 2021, SS554 (existing seed script)
- **Supabase** — existing project (`jertvmbhgehajcrfifwl`), existing schema

### New Requirements
- **Human-readable interpretation layer** — map threshold bands to plain-language insights
- **Business impact language** — workforce/productivity implications per metric band
- **Action recommendations** — practical steps per metric band and context (office, industrial, etc.)

### Out of Scope (for now)
- PDF report generation (removed from MVP)
- QA gate checklist (removed from MVP)
- Report approval workflow (removed from MVP)
- Certification outcomes (may return later, not MVP)

---

## 5. User Flows

### Phase 1: Upload → Dashboard
```
Analyst uploads CSV
  → Backend parses and evaluates against rulebook
  → Frontend displays site overview + zone details
  → Each metric card shows: value + human interpretation + recommended action
```

### Phase 3: Live → Dashboard
```
uHoo API streams readings
  → Backend ingests and evaluates in near-real-time
  → Frontend auto-refreshes cards
  → Alerts when metrics cross into Action Required
```

---

## 6. What Changes from Current Codebase

### Keep (reuse)
- **Data ingestion pipeline** — CSV parsing, Supabase storage, readings table
- **Rule engine** — threshold evaluation (WHO/SS554)
- **Supabase infra** — connection, schema, existing data
- **Backend API structure** — FastAPI + SQLModel
- **Frontend framework** — Next.js + Shadcn UI
- **TimeSeriesChart** — trend visualisation (already human-friendly with threshold bands)

### Discard / Deprecate
- **PDF report generation** — `pdf_orchestrator.py`, report templates, WeasyPrint
- **QA gate system** — `qa_gates.py`, QA checklist UI
- **Report approval workflow** — approve/export endpoints
- **Certification outcomes** — Healthy Workplace Certified etc.
- **Findings model as compliance record** — refactor to "insights"

### Rewrite
- **Frontend** — from compliance findings panel → human-friendly metric cards with interpretation text
- **Interpretation layer** — from templated rule interpretations → contextual, human-readable insights
- **Executive view** — from compliance summary → simple "how's our space doing" overview

---

## 7. Constraints

- **Timeline**: Solo developer (Jeff)
- **Team size**: 1 (with Jay Choy as product approver)
- **Budget**: Minimal — leverage existing Supabase infra, open-source tools
- **Existing investment**: ~9 months of build (PR1-9). Goal is to pivot, not restart.

---

## 8. Success Criteria

- Jay Choy can look at the dashboard and understand site health in **under 30 seconds** without needing to know what "850ppm CO₂" means
- A facility manager can identify which zone needs attention and **what to do about it**
- uHoo data is consumed and displayed with human-readable context, not just raw numbers
- Dashboard works with batch CSV uploads (Phase 1) and eventually live API data (Phase 3)

---

## 9. Open Questions for Jay Choy

1. **Dashboard scope**: Should this replace the uHoo native dashboard entirely, or complement it? (i.e., do customers need to see both?)
2. **Metrics prioritisation**: Which 3-5 metrics matter most to facility managers? (CO₂, PM2.5, temperature, humidity, TVOC — rank them)
3. **Alert threshold**: When should the dashboard flag "Action Required"? At the rule threshold, or earlier/later?
4. **Live data priority**: How important is real-time (Phase 3 live API) vs batch uploads? Does Phase 1 CSV-only meet immediate needs?
5. **Customer access**: Should facility managers see this dashboard directly (self-service), or is it always presented by FJ staff?
6. **Branding**: Should this be branded as "FJ SafeSpace Dashboard" or something else?
7. **Multi-site view**: Jay needs to see all sites at once — should this be the default view (portfolio) or site-by-site?

---

## 10. Not in Scope (MVP)

- PDF report generation and export
- Certification / compliance documentation
- QA gate workflows
- Report approval chains
- Multi-scan comparison / before-after analysis
- Customer self-service portal with auth
- BMS/IoT automation
- Historical trend analysis beyond last upload window

---

## 11. Technical Approach

- **Reuse existing backend** — FastAPI, Supabase, rule engine
- **Rewrite frontend** — human-friendly card-based layout
- **Add interpretation layer** — new service that maps rule outputs to plain-language insights
- **Keep data schema** — no migration needed for existing readings/findings
- **Phase 1 delivery**: CSV upload → human-readable dashboard (no PDFs, no compliance)
- **Phase 2**: Cross-site portfolio view
- **Phase 3**: Live API ingestion + real-time refresh
