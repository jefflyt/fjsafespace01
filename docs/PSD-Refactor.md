# FJ SafeSpace Dashboard — Refactor PSD (PSD-R1)

| Field | Value |
| --- | --- |
| **Document** | FJ SafeSpace Dashboard PSD-R1 v0.1 |
| **Scope** | Real-time human-friendly IAQ wellness dashboard |
| **Date** | 2026-04-23 |
| **Owner** | Jeff |
| **Status** | Draft — all open questions resolved with Jay Choy |
| **Supersedes** | FJDashboard PSD-02 (compliance/reporting model) |

---

## 1. Product Overview

FJ SafeSpace Dashboard **replaces** the uHoo native dashboard as the
customer-facing IAQ interface. Unlike uHoo's native dashboard which shows
raw metrics only (e.g., "CO₂: 850ppm") in a highly technical format, this
dashboard translates those numbers into **what they mean for the people
inside**:

> **CO₂: 850ppm → "Staff may feel drowsy. Consider opening a window or boosting ventilation."**

The system consumes uHoo sensor data (via CSV upload for adhoc scans, live
API for continuous monitoring) and surfaces insights in plain language,
colour-coded for urgency.

### Problem

- uHoo's native dashboard shows raw metric trends but no interpretation
- Non-technical stakeholders (facility managers, executives) cannot act on "850ppm CO₂"
- No consolidated view across multiple sites with human-readable risk signals

### Solution

A single dashboard that:

1. **Ingests** IAQ data (CSV batch upload or live API)
2. **Evaluates** against selected certification standards (WELL, ASHRAE, SS554, SafeSpace)
3. **Translates** findings into human-friendly insights with business impact language
4. **Displays** real-time status cards per site/zone with colour-coded urgency

---

## 2. Target Users

| Persona | Key Needs |
| --- | --- |
| **Jay Choy (Executive / Decision Maker)** | One-page overview of all sites with clear status and action guidance. |
| **Analyst / Operations (FJ Staff)** | Upload data, configure monitoring, select standards, and view insights. |
| **Facility Manager (Customer)** | Self-service access to the site's wellness dashboard with simple metric guidance. |

---

## 3. Customer Management

For continuous monitoring self-service, each facility manager must only see
their own site's data. This requires customer management with authentication
and tenant isolation.

### 3.1 Authentication

- **Supabase Auth** — facility managers log in via Supabase authentication (email/password or magic
    link)
- **Two roles**:
  - **FJ Staff (admin)**: sees all sites, configures continuous monitoring,
    manages standards
  - **Facility Manager (customer)**: sees only their assigned site(s),
    self-service dashboard access
- **Tenant-based access control** — every API response is filtered by
  `tenant_id`; facility managers cannot access data outside their tenant

### 3.2 Tenant Model

- Uses existing `tenant` table (already in schema, previously deferred to Phase 3)
- **Tenant → Site relationship**: each site has a `tenant_id` FK; a tenant can have one or more sites
- **FJ staff is not tied to a tenant** — admin role bypasses tenant filter
- **Facility manager is tied to a tenant** — all queries automatically scoped to their `tenant_id`

### 3.3 What This Enables

- **Self-service continuous monitoring** — facility manager logs in and sees live dashboard for their
    site only
- **Self-service adhoc view** — facility manager can view results from adhoc scans uploaded by FJ
    staff
- **Email alerts scoped to tenant** — alert notifications only go to the relevant facility manager
- **No cross-tenant data leakage** — enforced at API middleware level, not just UI

### 3.4 Scope for R1/R2

- Authentication (Supabase Auth) + tenant isolation middleware
- No full customer portal — just auth so facility managers can access their own dashboard
- FJ staff retains admin access to all sites (no auth barrier for internal
  team in R1)
- Full customer self-service portal (profile management, alert preferences,
  report downloads) deferred to later stage

---

## 4. Certification Standards

The platform evaluates IAQ data against **4 independent certification
standards**. Customers choose which standard(s) to follow — each is judged
separately with its own pass/fail outcome.

### 4.1 Available Standards

| Standard | Description | Thresholds Stored In |
| --- | --- | --- |
| **WELL Building Standard** | IWBI WELL v2 — global commercial health standard | Supabase `rulebook_entry` table. |
| **ASHRAE 62.1** | US ventilation and thermal comfort standard | Supabase `rulebook_entry` table. |
| **SS554** | Singapore IAQ standard — local regulatory compliance | Supabase `rulebook_entry` table. |
| **SafeSpace** | FJ's proprietary standard with proprietary thresholds | Supabase `rulebook_entry` table. |

### 4.2 How Standards Work

- **Supabase is the source of truth** — all thresholds, weights, and
  evaluation criteria for each standard are stored in the `rulebook_entry`
  table, linked via `reference_source`
- **Each standard is independently judged** — a site can pass WELL but fail SS554, or pass SafeSpace
    but not ASHRAE
- **Default standard**: All sites default to SS554. Customers can add or switch to other standards.
- **Selection at two levels**:
  - **Site level**: FJ staff configures the default standard(s) for a site during setup
  - **Scan level**: individual CSV upload or monitoring session can add or override standards
- **Multiple standards can be active simultaneously** — dashboard shows separate pass/fail for each
    selected standard
- **SafeSpace thresholds**: Placeholder value stored in Supabase; will be defined manually by Jay/FJ
    team later
- **SS554 thresholds**: Placeholder for now; certification document to be loaded and digested into
    Supabase when available

### 4.3 Standard Selection in the Dashboard

- During CSV upload or continuous monitoring setup, user selects which
  standard(s) to evaluate against
- Site cards show only the standards that have been selected for that site/scan
- Each standard displays its own wellness index score and certification outcome
- No "overall" rating that combines standards — each stands alone

### 4.4 SafeSpace Standard

- FJ's proprietary IAQ standard — unique thresholds, not derived from WELL/ASHRAE/SS554
- Designed to be FJ's differentiator — reflects FJ's expertise and judgment on indoor air quality
- Thresholds defined by Jay Choy / FJ team, stored in Supabase like other standards
- Can be positioned as "the FJ guarantee" — if you pass SafeSpace, you pass FJ's own bar
- **Placeholder UX**: Until SafeSpace thresholds are defined by the FJ team,
  the dashboard shows "SafeSpace: Coming Soon — thresholds under development"
  instead of a score. The standard is visible in the standard selector but
  grayed out with a tooltip explaining it's not yet active.

---

## 5. Scan Types

The platform supports **two distinct scan types**, each with different data sources, cadence, and
dashboard behavior:

### 5.1 Adhoc Scan (Assessment / Intervention Impact)

- **Purpose**: Point-in-time IAQ assessment — a "snapshot" of indoor air quality at a specific moment
- **Data Source**: CSV upload from uHoo device export
- **Cadence**: On-demand — triggered by FJ staff or facility manager as needed
- **Report Type**: Assessment (baseline IAQ health) or Intervention Impact (before/after comparison)
- **Dashboard Behavior**: Shows results from the most recent upload window; static until next upload
- **Use Cases**:
  - Initial site assessment (baseline)
  - Post-intervention verification (e.g., "did opening windows help?")
  - Compliance audits, tenant complaints, executive reviews

### 5.2 Continuous Monitoring

- **Purpose**: Ongoing, real-time IAQ surveillance — "always-on" wellness tracking
- **Data Source**: uHoo API (live device stream, polled at intervals)
- **Cadence**: 24-hour connected monitoring, auto-refreshed
- **Dashboard Behavior**: Live-updating cards, trend charts stream in
  real-time, alerts trigger when thresholds are crossed
- **Use Cases**:
  - Facility managers who want ongoing visibility
  - Sites with known IAQ issues under observation
  - Long-term wellness programs

### 5.3 How the Two Scan Types Coexist

| Aspect | Adhoc Scan | Continuous Monitoring |
| --- | --- | --- |
| **Data Ingestion** | CSV upload | uHoo API polling |
| **Refresh** | Manual (per upload) | Automatic (interval-based) |
| **Time Window** | Upload snapshot | Rolling 24h / configurable |
| **Report** | Assessment / Intervention Impact PDF | Live dashboard only (no PDF per interval) |
| **Alerts** | Post-evaluation findings | Real-time threshold breach alerts |
| **Cost Model** | Per-scan | Subscription / always-on |

A **site can have both**: an initial adhoc assessment establishes baseline,
then continuous monitoring keeps the dashboard live. The dashboard UI should
clearly indicate which mode a site is in.

---

## 6. Core Features

### 6.1 Site Overview Card

Per site, display:

- **Site name** and **last updated** timestamp
- **Scan mode indicator**: "Last uploaded 2 hours ago" (Adhoc) or
  "Live — connected" (Continuous)
- **Active standards**: only the standards selected for this site/scan, each
  with its own wellness score and pass/fail outcome
- **Overall wellness rating** (colour-coded, based on selected standards):
  - Green: Healthy — all parameters within acceptable range
  - Yellow: Attention Needed — one or more parameters elevated
  - Red: Action Required — one or more parameters at concerning levels
- **Top insight** — single most important human-readable finding (e.g., "CO₂
  elevated in Meeting Room A — staff may feel drowsy")
- **Multi-site view**: Portfolio view showing all sites at once (Jay's
  default view), with filter to show only sites needing attention

### 6.2 Zone Detail View

Per zone within a site:

- **Standard selector** — switch between active standards to see evaluation against each
- **Metric selector** — facility manager chooses which metrics to display. Not all metrics are
    relevant to every site.
  Preferences are stored per-site in Supabase (`site_metric_preferences` table). If a facility
manager manages multiple sites, each has its own metric preferences.
- **Metric cards** — each metric shows:
  - Current value + unit
  - Colour-coded status per selected standard (each standard may rate the
    same value differently)
  - **Human-readable interpretation** (e.g., "Temperature at 28°C — staff
    may feel restless and lose focus")
  - **Recommended action** (e.g., "Check air conditioning settings")
- **Configurable alert thresholds** — facility manager can adjust thresholds
  within safe bounds. Safe bounds are defined by the Rulebook (`min_value`,
  `max_value` on `rulebook_entry`) — users cannot set thresholds outside
  these bounds. Overridden thresholds affect alert triggers only, NOT the
  wellness index calculation (which always uses Rulebook values).
- **Trend chart** — last 24 hours (or full upload window) showing the metric
  over time with threshold bands for the selected standard
  - Adhoc: static chart from uploaded data
  - Continuous: live-updating chart with streaming data

### 6.3 CSV Upload (Adhoc Scans)

- Upload uHoo CSV export
- Select which standard(s) to evaluate against
- Parse → evaluate → display results
- Select report type: Assessment (baseline) or Intervention Impact (before/after)
- Batch processing on upload

### 6.4 uHoo API Integration (Continuous Monitoring)

- Connect to uHoo API for live device stream
- Poll at configurable intervals (e.g., every 5-15 minutes)
- Auto-refresh dashboard cards without page reload
- Real-time alert when a metric crosses into "Action Required"
- Device health indicator (online/offline, last heartbeat)

### 6.5 Cross-Site Comparison

- **Admin view (FJ Staff only)**: Leaderboard of all sites ranked by overall wellness across the
    portfolio
- **Facility Manager view**: Only sees their own site(s) — no cross-tenant comparison visible
- Quick filter: show only sites needing attention (admin only)
- Filter by scan mode: "Live sites only" or "All sites" (admin only)
- Filter by standard: show rankings per selected standard
- **PDF reference (R3)**: Cross-site comparison section included in PDF reports. It shows how the site
    ranks
  against the portfolio average using aggregated, anonymized data.
  No other tenant names or scores are visible.

---

## 7. Data Requirements

### Retained from Current System

- **Readings table** — `site_name`, `zone_name`, `device_id`,
  `reading_timestamp`, `metric_name`, `metric_value`, `metric_unit`
- **Supabase** — existing project (`jertvmbhgehajcrfifwl`), existing schema

### Rulebook / Standards (Supabase as Source of Truth)

- **Reference sources** — WELL, ASHRAE, SS554, SafeSpace (each a `reference_source` entry)
- **Citation units** — verbatim excerpts linked to each standard source
- **Rulebook entries** — thresholds, weights, interpretations per standard, stored in `rulebook_entry`
    table
  - Each rule links to a `reference_source` (the standard it belongs to)
  - Each rule has `rule_version`, `index_weight_percent`, `threshold_type`, `min_value`, `max_value`
  - Supabase is the source of truth — no hardcoded thresholds in application logic

### New Requirements

- **Human-readable interpretation layer** — map threshold bands to plain-language insights
- **Business impact language** — workforce/productivity implications per metric band
- **Action recommendations** — practical steps per metric band and context (office, industrial, etc.)
- **Scan type tracking** — `scan_type` field on uploads/sessions (`adhoc` or `continuous`)
- **Device connection state** — for continuous monitoring, track device online/offline status, last
    heartbeat
- **API credentials store** — uHoo API keys per site/device for continuous
  monitoring (configured by FJ staff)
- **Standard selection** — per-site standard preferences (FJ staff configures
  during setup; SS554 is default)
- **Metric selection** — facility manager can choose which metrics to display on their dashboard
- **Configurable alert thresholds** — facility manager can adjust thresholds within safe bounds
- **SafeSpace standard** — new `reference_source` + placeholder rulebook
  entries in Supabase (thresholds to be defined later)
- **SS554 standard** — new `reference_source` + placeholder rulebook entries in Supabase
    (certification document to be loaded later)
- **Email alert system** — for continuous monitoring threshold breach notifications (SMS/WhatsApp in
    later stage)
- **Customer management** — Supabase Auth for facility manager login, tenant-based access control, FJ
    staff admin role

### Out of Scope (for now)

- SMS/WhatsApp alert channels (email only for initial release)
- BMS/IoT automation (dashboard shows data, does not control HVAC/BMS)

---

## 8. User Flows

### Flow A: Adhoc Scan (CSV Upload → Dashboard)

```text
FJ staff uploads CSV + selects standard(s) to evaluate against + report type
  → Backend parses and evaluates against selected standard(s) rulebook
  → Frontend displays site overview + zone details with per-standard results
  → Each metric card shows: value + human interpretation + recommended action
  → Dashboard shows "Last uploaded: <timestamp>" indicator + per-standard pass/fail
  → Facility manager accesses dashboard via self-service
  → Optional: generate Assessment/Intervention Impact PDF report
```

### Flow B: Continuous Monitoring (uHoo API → Live Dashboard)

```text
FJ staff configures site for continuous monitoring (uHoo API connected + standard(s) selected)
  → Backend polls uHoo API at configured interval
  → New readings ingested and evaluated against selected standard(s)
  → Frontend auto-refreshes cards via polling or WebSocket
  → Real-time alerts when metrics cross into "Action Required" for any selected standard
  → Alerts sent via email (SMS/WhatsApp in later stage)
  → Dashboard shows "Live — connected" indicator + per-standard pass/fail
  → Facility manager accesses dashboard via self-service
  → Device health monitored (online/offline alerts)
```

---

## 9. What Changes from Current Codebase

### Keep (reuse)

- **Data ingestion pipeline** — CSV parsing, Supabase storage, readings table
- **Supabase infra** — connection, schema, existing data
- **Backend API structure** — FastAPI + SQLModel
- **Frontend framework** — Next.js + Shadcn UI
- **TimeSeriesChart** — trend visualisation (already human-friendly with threshold bands)

### Refactor

- **Rule engine** — currently evaluates against a single unified rule set.
  It needs per-standard evaluation with standard selection at site/scan level.
- **Wellness index** — currently single score; needs per-standard score calculation
- **Seed script** — add SS554 and SafeSpace sources + rules; reorganize existing rules by standard

### Discard / Deprecate

- **QA gate system** — `qa_gates.py`, QA checklist UI (deferred to R3)
- **Report approval workflow** — approve/export endpoints (deferred to R3)
- **Unified certification outcome** — single outcome replaced by per-standard outcomes (deferred to
    R3)
- **Findings model as compliance record** — refactor to "insights"

### Rewrite

- **Frontend** — from compliance findings panel → human-friendly metric cards with interpretation text
  and standard selector
- **Interpretation layer** — from templated rule interpretations → contextual, human-readable insights
- **Executive view** — from compliance summary → simple "how's our space doing" overview with
  per-standard badges

---

## 10. Constraints

- **Timeline**: Solo developer (Jeff)
- **Team size**: 1 (with Jay Choy as product approver)
- **Budget**: Minimal — leverage existing Supabase infra, open-source tools
- **Existing investment**: ~9 months of build (PR1-9). Goal is to pivot, not restart.
- **Mobile/Responsive**: Facility managers may access the dashboard from phones while on-site.
  The dashboard must be usable on mobile screens (375px minimum width).
  Design follows `docs/DESIGN_GUIDELINES.md` for responsive breakpoints.

---

## 11. Success Criteria

- Jay Choy can look at the dashboard and understand site health in **under 30 seconds** without
    needing to know what "850ppm CO₂" means
- A facility manager can identify which zone needs attention and **what to do about it**
- uHoo data is consumed and displayed with human-readable context, not just raw numbers
- Dashboard supports both adhoc CSV uploads and continuous API monitoring, with clear scan-mode
    indicators
- Each selected standard produces its own independent pass/fail outcome

---

## 12. Not in Scope (Initial Release)

- Full customer portal (profile management, alert preferences, report downloads — auth + tenant
    isolation only)
- PDF report generation and export for continuous monitoring (PDFs only for adhoc
    Assessment/Intervention Impact reports)
- Certification / compliance documentation (deferred to R3)
- QA gate workflows (deferred to R3)
- Report approval chains (deferred to R3)
- BMS/IoT automation (dashboard shows data, does not control HVAC/BMS)
- Historical trend analysis beyond rolling window
- SMS/WhatsApp alert channels (email only)

---

## 13. Migration Plan

### 13.1 Existing Data

The current codebase has ~9 months of build data: sites, uploads, readings, findings, and reports.
These must survive the refactor.

- **Existing sites**: currently have nullable `tenant_id`. A migration script will create a default
    tenant ("FJ Internal") and assign all existing sites to it. This preserves backward compatibility
    while activating tenant isolation.
- **Existing uploads/readings**: no schema changes needed — they remain linked to their existing
    `site_id`.
- **Existing findings**: will be marked as "legacy" and retained for historical reference. New
    evaluations use the per-standard interpretation layer.
- **Existing reports**: remain accessible via the immutable HTML snapshot architecture (migration
    005). No changes to PDF generation for historical reports.

### 13.2 Tenant Activation

- Create a default tenant via seed script: `tenant_name = "FJ Internal"`, `contact_email =
    admin@fjsafespace.com"`. All existing sites get assigned to this tenant.
- Add a `tenant_id` column to `user` table (nullable for FJ staff, required for facility managers).
- Supabase Auth users linked to tenants via a `user_tenant` mapping table (one user can manage
    multiple sites across one or more tenants).

### 13.3 Rulebook Reorganization

- Run `seed_rulebook_v1.py` refactored to create 4 `reference_source` entries: WELL, ASHRAE, SS554,
    SafeSpace.
- Existing WHO AQG 2021 rules → link to WELL source (closest match).
- Existing IAQ rules → link to SS554 source.
- Create placeholder entries for SafeSpace and SS554 (thresholds to be defined later).
- All existing rulebook entries get a `rule_version` bump to `v2-refactor` to distinguish from legacy
    evaluations.

### 13.4 Rollback Strategy

- All schema changes are additive (new columns nullable, new tables) — reversible via Alembic
    downgrade.
- Default tenant creation is idempotent — safe to re-run.
- Frontend refactor: keep old routes (`/ops`, `/executive`) as redirects to new routes during
    transition period.

## 14. API Security & Access Control

### 14.1 Authentication Flow

- **FJ Staff**: no auth barrier in R1 (internal laptop access). Auth added in R3 when full customer
    portal ships.
- **Facility Manager**: Supabase Auth (email + magic link). JWT included in `Authorization: Bearer
    <token>` header on all API requests.
- **JWT Extraction**: FastAPI middleware extracts `tenant_id` from JWT claims. All queries scoped by
    this claim.
- **Session expiry**: 24 hours (magic link), refreshable via Supabase SDK.

### 14.2 Tenant Isolation Middleware

- FastAPI dependency `get_current_tenant()` extracts `tenant_id` from JWT. All facility-manager-facing
    routes require this dependency.
- FJ staff routes bypass tenant filter (admin role).
- Direct database access (SQLModel) enforces `tenant_id` WHERE clause — not just API-level filtering.

### 14.3 Rate Limiting

- CSV upload: 10 uploads per minute per user (prevents accidental duplicate uploads).
- Dashboard polling: 1 request per 30 seconds per user (for continuous monitoring).
- uHoo API polling: backend-initiated, not user-facing — no rate limit from frontend.
- Email alerts: deduplicated — max 1 alert per metric per zone per 4 hours (see Section 16).

### 14.4 Row Level Security (Supabase)

- RLS policies on `site`, `reading`, `finding`, `report` tables: facility manager role can only
    SELECT/INSERT rows where `tenant_id` matches their claim.
- FJ staff role bypasses RLS (service role key).
- RLS is a defense-in-depth layer — app-level middleware is the primary enforcement.

## 15. Error Handling & Edge Cases

### 15.1 CSV Upload Errors

| Error | User Message | Recovery |
| --- | --- | --- |
| File not a CSV | "Invalid file format. Please upload a CSV file." | Re-upload |
| CSV missing required columns | "CSV is missing required columns: [list]. Expected: [list]." | Fix CSV and re-upload |
| CSV has malformed rows | "Some rows were invalid and skipped." | Review rows and re-upload. |
| Duplicate upload (same hash) | "This file appears to have been uploaded already." | Use existing results. |
| Empty CSV (0 data rows) | "No data rows found. Please check your CSV file." | Re-upload |

### 15.2 uHoo API Errors

| Error | User Message | Recovery |
| --- | --- | --- |
| API unreachable | "Unable to connect to monitoring device. Last reading: [timestamp]." | Auto-retry and alert staff. |
| API rate limited | "Data refresh delayed. Next update in [X] minutes." | Backoff and retry later. |
| Device offline | "Device offline since [timestamp]." | Alert staff; stale data shown. |
| Partial data (some metrics missing) | "Some metrics unavailable." | Show available metrics only. |

### 15.3 Data Validation

- **Acceptable ranges**: CO₂ (300-5000 ppm), PM2.5 (0-500 μg/m³), TVOC (0-10000 ppb), Temperature
    (10-45°C), Humidity (10-95% RH). Values outside these ranges are flagged as sensor errors, not IAQ
    issues.
- **Missing timestamps**: rows without valid timestamps are rejected with a warning.
- **Negative values**: rejected for all metrics (physically impossible for IAQ sensors).

### 15.4 Dashboard Error States

- **Backend down**: Frontend shows "Dashboard unavailable. Please try again later." with last cached
    data (if available).
- **No data for site**: "No scan data available. Upload a CSV to get started."
- **No standards selected**: "No certification standards configured for this site. Contact FJ staff to
    set up standards."

## 16. Email Alert System

### 16.1 Trigger Conditions

- Email sent when any metric crosses into "Action Required" (Red) threshold for any active standard.
- Alert includes: site name, zone, metric name, current value, threshold exceeded, human-readable
    impact, recommended action.
- Alert scoped to tenant — only the facility manager for that site receives the alert.

### 16.2 Deduplication

- **Cooldown period**: 4 hours between alerts for the same metric in the same zone. If the metric
    stays in "Action Required" state, no repeat alert.
- **Recovery notification**: When a metric returns to "Healthy" or "Attention Needed" state after
    being "Action Required", a single recovery email is sent: "[Metric] has returned to normal range."
- **Batch alerts**: If multiple metrics go red simultaneously, they are combined into a single email
    (not one email per metric).

### 16.3 Email Template

```text
Subject: [FJ SafeSpace] Action Required: [Metric] in [Zone] at [Site]

Hi [Facility Manager Name],

Your [Site] dashboard has detected an issue that needs attention:

  Metric: [Metric Name]
  Zone: [Zone Name]
  Current Value: [Value] [Unit]
  Threshold: [Threshold] (per [Standard])
  Status: Action Required

What this means: [Human-readable interpretation, e.g., "CO₂ levels indicate
poor ventilation. Staff may feel drowsy and lose focus."]

Recommended action: [Action, e.g., "Check air conditioning settings or
increase fresh air intake."]

View your dashboard: [link]

This alert was generated by FJ SafeSpace at [timestamp].
```

### 16.4 Email Recipient Mapping

- Email address comes from the Supabase Auth user profile linked to the tenant.
- FJ staff receives a copy of all tenant alerts (monitoring/oversight).
- Multiple facility managers for one tenant: all receive the alert (no primary/secondary distinction
    in R1).

## 17. Performance SLAs

| Metric | Target | Notes |
| --- | --- | --- |
| Dashboard load time | < 3 seconds | From click to fully rendered page |
| CSV upload processing | < 30 seconds | For files up to 10 MB (~50,000 rows) |
| CSV file size limit | 10 MB max | Files larger than 10 MB are rejected with a clear message |
| API response time | < 500 ms (p95) | For dashboard data queries |
| Dashboard polling interval | Every 30 seconds | For continuous monitoring refresh |
| uHoo API polling interval | Every 5-15 minutes | Configurable per site by FJ staff |
| Email alert delivery | < 2 minutes from threshold breach | Via Resend API |
| PDF generation | < 2 minutes | For reports up to 50 pages |

## 18. Testing Strategy

### 18.1 Existing Tests

- **Backend** (55 passed, 47 skipped): QA gate tests, dashboard endpoint tests, unit tests for
    aggregation, CSV parsing, rule engine. These will be preserved but QA gate tests move to R3
    (disabled in R1).
- **Frontend** (Vitest): WellnessIndexCard, CitationBadge, CrossSiteComparisonTable, TrendChart tests.
    These will be updated to match new component architecture.

### 18.2 New Tests for R1

- **Tenant isolation**: Integration tests verifying facility manager can only access their own
    tenant's data.
- **Per-standard evaluation**: Unit tests for rule engine evaluating against multiple standards
    simultaneously.
- **Interpretation layer**: Unit tests mapping threshold bands to human-readable insights.
- **Auth middleware**: Unit tests for JWT extraction and tenant scoping.

### 18.3 New Tests for R2

- **uHoo API polling**: Mock-based tests for API ingestion, retry logic, and error handling.
- **Email alert deduplication**: Unit tests for cooldown period and batching logic.
- **Real-time refresh**: Integration test for dashboard auto-refresh pipeline.

### 18.4 Test Preservation Rules

- No existing test is deleted — only moved or marked skip for R1.
- All QA gate tests (QA-G1 to QA-G8) move to R3 test suite.
- Test coverage target: maintain > 80% backend, > 70% frontend.

---

## 19. Delivery Phases

Each phase is **independently deployable and production-ready**. No throwaway code — everything
ships to real users.

### Phase R1: Adhoc Scan Dashboard (production first)

**Goal**: Jay can upload a CSV, select a standard, and see human-readable site health in under 30
seconds.

**What ships**:

- CSV upload → parse → evaluate against selected standard(s) → display (reuses existing PR2 upload
    pipeline)
- Standard selection during upload (FJ staff selects; SS554 is default)
- Site overview cards with wellness rating per standard, scan mode indicator, and top insight
- Multi-site portfolio view (Jay's default — all sites at once)
- Zone detail view with metric cards (value + human interpretation + recommended action)
- Metric selector — facility manager chooses which metrics to display
- Configurable alert thresholds — facility manager can adjust within safe bounds
- Standard selector in zone detail — switch between active standards to see different evaluations
- Trend charts with threshold bands (reuses existing TimeSeriesChart)
- Cross-site comparison leaderboard with filters (by standard, by scan mode)
- Interpretation layer service (threshold bands → plain-language insights)
- **Customer management (R1)**: Supabase Auth setup, tenant table activated, tenant isolation
    middleware, FJ staff admin role
- Self-service access for facility managers (login required)

**Rulebook work for R1**:

- Add SafeSpace `reference_source` + placeholder rulebook entries in Supabase (thresholds to be
    defined later)
- Add SS554 `reference_source` + placeholder rulebook entries in Supabase (certification document to
    be loaded later)
- Reorganize existing rules: WELL rules linked to WELL source, ASHRAE rules linked to ASHRAE source
- Supabase remains the single source of truth for all thresholds

**What changes from current codebase**:

- Frontend: compliance findings panel → human-friendly metric cards
- Rule engine: single unified evaluation → per-standard evaluation
- Executive view: compliance summary → "how's our space doing" overview with per-standard badges
- QA gates and approval workflow: **disabled for R1** (simplified upload-to-display flow)
- PDF generation: **not wired in R1** (moved to R3)

**Reuse from PR1-8**: Upload pipeline, Supabase schema, dashboard endpoints, TimeSeriesChart,
wellness index calculation (refactored for per-standard scoring)

**Deployment**: Vercel (frontend) + Render (backend) + Supabase (DB) — same infra

### Phase R2: Continuous Monitoring

**Goal**: Sites with uHoo devices show live, auto-updating dashboard with real-time alerts.

**What ships**:

- uHoo API polling service (configurable interval: 5-15 min)
- Real-time reading ingestion and evaluation pipeline against selected standard(s)
- Dashboard auto-refresh (polling or WebSocket)
- Live-updating trend charts with streaming data
- Real-time alerts when metrics cross into "Action Required" for any selected standard
- Email alert notifications (SMS/WhatsApp in later stage)
- Device health indicator (online/offline, last heartbeat)
- Scan mode indicator: "Live — connected" vs "Last uploaded: [timestamp]"
- Self-service access for facility managers

**Architecture decisions**:

- Polling service runs on Render (same backend, separate process or scheduled task)
- uHoo API credentials stored per site/device in Supabase
- All configuration and setup done by FJ staff (not facility manager)
- Shared components: rule engine, metric cards, wellness index — no duplication from R1

**Prerequisites**: uHoo API access confirmed available

### Phase R3: PDF Report Pipeline (full compliance)

**Goal**: Professional Assessment/Intervention Impact PDF reports for adhoc scans, with per-standard
certification outcomes.

**What ships**:

- PDF report generation (WeasyPrint templates from PR9) — updated to show per-standard results
- QA gate system (QA-G1 to QA-G8) — reinstated
- Report approval workflow (reviewer name, date, approval enforcement)
- Assessment vs Intervention Impact report type selection
- Immutable HTML snapshot architecture (migration 005)
- On-demand PDF generation from stored snapshot
- Per-standard certification outcome on PDF (e.g., "WELL: Certified, SafeSpace: Certified, SS554: Not
    Certified")
- Cross-site comparison reference section — shows how the site ranks against portfolio average
    (admin-view only, tenant-isolated data aggregated anonymized)
- Site context block on cover page: client name, site address, premises type, comparative analysis
    flag (from PR9 customer info fields)

**Reuse from PR5/PR8/PR9**: WeasyPrint templates, QA gate logic, approval endpoints, snapshot
architecture

**Why last**: The adhoc dashboard (R1) delivers value immediately. Reports are a professional
deliverable that customers receive — they need the dashboard insights first, then the formal PDF for
documentation.
