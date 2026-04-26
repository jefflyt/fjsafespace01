# MASTER PLAN: FJ SafeSpace Dashboard Refactor

## 1. Product Summary

The FJ SafeSpace Dashboard replaces the uHoo native dashboard as the customer-facing IAQ interface. Unlike uHoo's technical raw-metric display (e.g., "CO₂: 850ppm"), this dashboard translates sensor data into **human-readable insights** about what those numbers mean for the people inside:

> **CO₂: 850ppm** → **"Staff may feel drowsy. Consider opening a window or boosting ventilation."**

The system ingests IAQ data via CSV upload (adhoc scans) or live uHoo API (continuous monitoring), evaluates it against selected certification standards (WELL, ASHRAE, SS554, SafeSpace), and surfaces colour-coded insights with business impact language. Each standard is judged independently — a site can pass WELL but fail SS554.

The current codebase represents ~9 months of prior build (PR1-8) focused on a compliance/reporting model. This refactor pivots that investment toward a wellness-first dashboard, reusing the upload pipeline, Supabase schema, and existing dashboard endpoints while replacing the compliance findings panel with human-friendly metric cards.

## 2. Goals, Success Criteria, and Constraints

### Goals

- Deliver a human-readable IAQ wellness dashboard that non-technical stakeholders can understand in under 30 seconds
- Support both adhoc CSV uploads and continuous API monitoring with clear scan-mode indicators
- Enable per-standard independent evaluation with separate pass/fail outcomes per standard
- Provide self-service access for facility managers with proper tenant isolation
- Preserve all ~9 months of existing data (sites, uploads, readings, findings, reports)

### Success Criteria

- Jay Choy can look at the dashboard and understand site health in under 30 seconds without needing to know what "850ppm CO₂" means
- A facility manager can identify which zone needs attention and what to do about it
- uHoo data is consumed and displayed with human-readable context, not just raw numbers
- Dashboard supports both adhoc CSV uploads and continuous API monitoring, with clear scan-mode indicators
- Each selected standard produces its own independent pass/fail outcome

### Constraints

- **Solo developer** (Jeff) — plan must be sequential, not parallel
- **Existing Supabase infra** — project `jertvmbhgehajcrfifwl`, no new database provisioning
- **~9 months of existing data must survive** — all schema changes are additive
- **Mobile-responsive** — dashboard must work on 375px minimum width (per docs/DESIGN_GUIDELINES.md)
- **Budget: minimal** — leverage existing open-source tools and Supabase infra
- **No throwaway code** — every PR is independently deployable and production-ready

## 3. Architecture & Technology Stack

Validated against TDD decisions. No alternatives proposed — TDD is already ratified.

| Component | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI, Recharts | Existing investment from PR1-8. Thin client — all business logic in backend. |
| **Backend** | FastAPI, Python 3.12+, SQLModel (SQLAlchemy 2.x) | Existing investment. Synchronous pipeline. |
| **Database** | PostgreSQL 16 (Supabase prod / Docker Compose local) | Existing. Supports JSON columns, TEXT[] arrays. |
| **Storage** | Supabase Storage (iaq-scans bucket) | Raw CSV uploads only. |
| **Auth** | Supabase Auth (R1 setup, R2 enforcement) | Magic link flow for facility managers. FJ staff has no auth in R1 (D-R1-07). |
| **Migrations** | Alembic | Existing. Migrations 001-007 exist. 008+ for refactor. |
| **Email** | Resend API (R2) | Existing `RESEND_API_KEY` in .env. |
| **PDF** | WeasyPrint (R3) | Existing investment from PR5/PR8, deferred to R3 (D-R1-06). |

### Key Architectural Decisions (from TDD)

- **D-R1-01**: Dual evaluation path — wellness index uses strict rulebook values (never modified); alert triggers use user-adjusted thresholds (within safe bounds)
- **D-R1-02**: Metric preferences are per-site, not per-user
- **D-R1-03**: Configurable thresholds affect alerts only, NOT wellness index
- **D-R1-04**: Cross-site comparison is admin-only (tenant isolation prevents facility managers from seeing other tenants)
- **D-R1-05**: Email deduplication uses 4-hour cooldown per metric/zone
- **D-R1-06**: PDF generation deferred to R3
- **D-R1-07**: FJ staff has no auth barrier in R1 (internal laptop access)
- **D-R1-08**: Old test suite deleted; new tests built fresh for R1
- **D-R1-09**: TEXT[] for active_metrics in site_metric_preferences
- **D-R1-10**: site_standards as separate table (not array column on site)

## 4. Project Phases

### Phase R1: Adhoc Scan Dashboard (Production First)

**Goal**: Jay can upload a CSV, select a standard, and see human-readable site health in under 30 seconds.

**Deliverables**:

- CSV upload with standard selection → parse → per-standard evaluation → dashboard display
- Site overview cards with per-standard wellness scores, scan mode indicator, top insight
- Zone detail view with metric cards (value + human interpretation + recommended action)
- Standard selector in zone detail (switch between active standards)
- Metric selector (facility manager chooses which metrics to display)
- Configurable alert thresholds (within safe bounds)
- Cross-site comparison leaderboard (admin-only)
- Interpretation layer service (threshold bands → plain-language insights)
- Supabase Auth setup + tenant isolation middleware + user_tenant mapping
- Self-service access for facility managers (login required)

**Rulebook work**:

- Add SafeSpace reference_source + placeholder rulebook entries
- Add SS554 reference_source + placeholder rulebook entries
- Reorganize existing rules: link WELL rules to WELL source, IAQ rules to SS554 source
- All existing rulebook entries get `rule_version` bump to `v2-refactor`

**Reuse from PR1-8**: Upload pipeline, Supabase schema, dashboard endpoints, TimeSeriesChart, wellness index calculation (refactored)

**Deferred from R1**: PDF generation, QA gates, report approval workflow

### Phase R2: Continuous Monitoring

**Goal**: Sites with uHoo devices show live, auto-updating dashboard with real-time alerts.

**Deliverables**:

- uHoo API polling service (configurable interval: 5-15 min)
- Real-time reading ingestion and evaluation pipeline
- Dashboard auto-refresh (polling or WebSocket)
- Live-updating trend charts
- Real-time email alerts on threshold breach (Resend API)
- Device health indicator (online/offline, last heartbeat)
- Alert deduplication (4-hour cooldown, D-R1-05)

**Prerequisites**: uHoo API access confirmed, device_connection table (migration 012), alert_log table (migration 013)

### Phase R3: PDF Report Pipeline

**Goal**: Professional Assessment/Intervention Impact PDF reports with per-standard certification outcomes.

**Deliverables**:

- PDF report generation (WeasyPrint templates from PR5/PR8, updated for per-standard results)
- QA gate system (QA-G1 to QA-G8) — reinstated
- Report approval workflow
- On-demand PDF generation from stored snapshot (migration 005 architecture)
- Per-standard certification outcome on PDF
- Cross-site comparison reference section (anonymized, tenant-isolated)

**Reuse from PR5/PR8/PR9**: WeasyPrint templates, QA gate logic, approval endpoints, snapshot architecture

## 5. Initial PR Breakdown (R1)

The R1 phase is broken into 6 independently deployable PRs, ordered for sequential delivery by a solo developer.

---

### PR-R1-01: Auth Foundation and Tenant Activation

**Scope**: Set up Supabase Auth infrastructure, create user_tenant mapping table, assign existing sites to default tenant, wire tenant isolation middleware.

**What this PR does**:

- Creates migration `014_user_tenant` for the user_tenant mapping table (supabase_user_id, tenant_id, role)
- Creates a seed script that generates a default tenant ("FJ Internal") and assigns all existing sites (those with NULL tenant_id) to it
- Adds Supabase Auth environment variables to config (`SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Replaces the stub `get_tenant_id()` dependency in `backend/app/api/dependencies.py` with proper JWT extraction from Supabase Auth
- Implements `get_current_tenant()` dependency that extracts tenant_id from JWT claims
- FJ staff routes continue to work without auth (D-R1-07) — auth is additive

**Files affected (backend)**:

- `backend/app/api/dependencies.py` — Replace stub with JWT extraction and tenant scoping
- `backend/app/core/config.py` — Add Supabase Auth config variables
- `backend/migrations/versions/014_user_tenant.py` — New migration
- `backend/app/models/supporting.py` — Add UserTenant SQLModel
- `scripts/seed_default_tenant.py` — New seed script

**Files affected (frontend)**:

- `frontend/lib/api.ts` — Add optional auth header injection
- `frontend/app/login/page.tsx` — New login page (Supabase magic link auth)
- `frontend/components/layout/AuthProvider.tsx` — New auth context component
- `frontend/app/layout.tsx` — Wrap with AuthProvider

**Dependencies**: None (first PR)

**Acceptance criteria**:

- Existing sites assigned to default "FJ Internal" tenant
- user_tenant table exists with proper constraints
- Backend JWT dependency extracts tenant_id from valid Supabase tokens
- FJ staff routes (no auth) continue to work
- Frontend can authenticate via Supabase magic link
- All existing data intact (no data loss)

---

### PR-R1-02: Rulebook Reorganization

**Scope**: Add SafeSpace and SS554 reference sources, reorganize existing rules by standard, bump rule versions.

**What this PR does**:

- Refactors `scripts/seed_rulebook_v1.py` to create 4 reference_source entries: WELL, ASHRAE, SS554, SafeSpace
- Links existing WHO AQG 2021 rules to WELL source
- Links existing IAQ rules to SS554 source
- Creates placeholder entries for SafeSpace and SS554
- Bumps all existing rulebook entries to `rule_version = "v2-refactor"`
- Adds `reference_source_id` FK to RulebookEntry model
- Rule engine gains awareness of `reference_source_id` for per-standard filtering
- `db_rule_service.py` gains `fetch_rules_by_standard()` function

**Files affected (backend)**:

- `scripts/seed_rulebook_v1.py` — Refactored to create 4 sources + per-standard rules
- `backend/app/models/workflow_a.py` — RulebookEntry gains `reference_source_id` FK
- `backend/app/services/db_rule_service.py` — Add `fetch_rules_by_standard()`
- `backend/app/skills/iaq_rule_governor/rule_engine.py` — Accept `standard_id` filter parameter
- `backend/app/skills/iaq_rule_governor/wellness_index.py` — Accept per-standard weight calculation
- `backend/migrations/versions/015_rulebook_standard_link.py` — Add FK + bump rule_version

**Files affected (frontend)**:

- No frontend changes (purely backend/data)

**Dependencies**: PR-R1-01

**Acceptance criteria**:

- 4 reference_source entries exist (WELL, ASHRAE, SS554, SafeSpace)
- Existing rules linked to appropriate sources
- SafeSpace shows as "Coming Soon" in API responses
- Rule engine can filter rules by standard
- `GET /api/rulebook/sources` returns all 4 sources
- Legacy rule_version entries preserved for historical data

---

### PR-R1-03: Schema Additions (Preferences, Standards, Context)

**Scope**: Create new database tables and columns needed for per-site preferences and standard selection.

**What this PR does**:

- Creates migration `008_site_context` — adds `context_scope` TEXT and `standard_ids` TEXT[] to site table
- Creates migration `009_scan_type` — adds `scan_type` TEXT and `standards_evaluated` TEXT[] to upload table
- Creates migration `010_site_metric_preferences` — new table (site_id UNIQUE, active_metrics TEXT[], alert_threshold_overrides JSONB)
- Creates migration `011_site_standards` — new table (site_id, reference_source_id, is_active)
- Adds SQLModel classes for SiteMetricPreferences and SiteStandards

**Files affected (backend)**:

- `backend/migrations/versions/008_site_context.py` — New migration
- `backend/migrations/versions/009_scan_type.py` — New migration
- `backend/migrations/versions/010_site_metric_preferences.py` — New migration
- `backend/migrations/versions/011_site_standards.py` — New migration
- `backend/app/models/workflow_b.py` — Add new columns to Site and Upload
- `backend/app/models/supporting.py` — Add SiteMetricPreferences and SiteStandards SQLModel
- `backend/app/models/enums.py` — Add ScanType enum if not present

**Files affected (frontend)**:

- No frontend changes (purely schema)

**Dependencies**: PR-R1-02

**Acceptance criteria**:

- All 4 new migrations apply cleanly
- SQLModel classes reflect new schema
- Existing data unchanged (all new columns nullable with defaults)
- site_metric_preferences has exactly one row per site (UNIQUE constraint)
- site_standards has unique (site_id, reference_source_id) constraint

---

### PR-R1-04: Backend API — Enhanced Upload and New Endpoints

**Scope**: Add new API endpoints for metric preferences, standards management, interpretations. Enhance upload endpoint for standard selection.

**What this PR does**:

- Enhances `POST /api/uploads` to accept `standards` parameter and store `standards_evaluated`
- Enhances `GET /api/uploads/{id}/findings` to include `standard_id`/`standard_title` per finding, add `standard_id` query param filter
- Adds `GET /api/sites/{id}/metric-preferences` and `PATCH /api/sites/{id}/metric-preferences`
- Adds `GET /api/sites/{id}/standards`, `POST /api/sites/{id}/standards/{source_id}/activate`, `POST /api/sites/{id}/standards/{source_id}/deactivate`
- Adds `GET /api/interpretations/{metric_name}/{threshold_band}` — interpretation layer
- Adds validation: alert_threshold_overrides must fall within rulebook min_value/max_value bounds
- Updates dashboard routes to apply tenant scoping via TenantIdDep
- Updates aggregation service for per-standard wellness index

**Files affected (backend)**:

- `backend/app/api/routers/uploads.py` — Enhance POST /uploads and GET /uploads/{id}/findings
- `backend/app/api/routers/dashboard.py` — Add tenant scoping to existing routes
- `backend/app/api/routers/preferences.py` — New router
- `backend/app/api/routers/interpretations.py` — New router
- `backend/app/schemas/dashboard.py` — Add new schemas
- `backend/app/schemas/interpretation.py` — New schema file
- `backend/app/services/aggregation.py` — Per-standard wellness index
- `backend/app/main.py` — Register new routers
- `backend/app/api/routers/rulebook.py` — Include reference_source_id in responses

**Files affected (frontend)**:

- `frontend/lib/api.ts` — Add typed functions for new endpoints

**Dependencies**: PR-R1-03

**Acceptance criteria**:

- POST /api/uploads accepts standards parameter and stores standards_evaluated
- GET /api/uploads/{id}/findings returns per-standard findings
- All preference endpoints return 200 with correct data
- PATCH validates metric names and threshold bounds
- GET /api/interpretations returns human-readable text for metric/band combinations
- Cross-site comparison endpoint respects tenant isolation
- All new endpoints return 400/404 for invalid inputs

---

### PR-R1-05: Frontend Refactor — Human-Friendly Dashboard

**Scope**: Replace compliance findings panel with human-friendly metric cards, site overview cards, zone detail view, standard selector, metric selector.

**What this PR does**:

- Refactors `/ops` page — Upload tab adds standard selector, Findings tab replaced with site overview + zone detail
- Refactors `/executive` page — per-standard badges on leaderboard, filter by standard and scan mode
- Creates new components: SiteOverviewCard, MetricCard, StandardSelector, MetricSelector, ThresholdConfigDialog, ZoneDetailView
- Keeps existing TimeSeriesChart (already suitable for threshold band display)
- Simplifies UploadForm (removes PR9 customer info fields, handled by Supabase Auth)
- Refactors WellnessIndexCard for per-standard display
- Updates CrossSiteComparisonTable for per-standard scores

**Files affected (frontend)**:

- `frontend/app/ops/page.tsx` — Refactored to use new dashboard layout
- `frontend/app/executive/page.tsx` — Refactored for per-standard badges
- `frontend/components/SiteOverviewCard.tsx` — New component
- `frontend/components/MetricCard.tsx` — New component
- `frontend/components/StandardSelector.tsx` — New component
- `frontend/components/MetricSelector.tsx` — New component
- `frontend/components/ThresholdConfigDialog.tsx` — New component
- `frontend/components/ZoneDetailView.tsx` — New component
- `frontend/components/UploadForm.tsx` — Add standard selector, simplify customer info
- `frontend/components/WellnessIndexCard.tsx` — Refactor for per-standard display
- `frontend/components/CrossSiteComparisonTable.tsx` — Update for per-standard scores
- `frontend/lib/api.ts` — Add typed functions for new endpoints

**Files affected (backend)**:

- No backend changes (APIs already implemented in PR-R1-04)

**Dependencies**: PR-R1-04

**Acceptance criteria**:

- Upload form includes standard selector (multi-select, SS554 default)
- After upload, dashboard shows site overview card with per-standard scores
- Zone detail shows metric cards with interpretation text and recommended actions
- Standard selector switches evaluation view between active standards
- Metric selector persists preferences per-site via API
- Threshold config dialog validates against rulebook bounds
- Executive dashboard shows per-standard badges on leaderboard
- Dashboard is responsive down to 375px width
- Colour coding matches PSD spec (green = healthy, yellow = attention, red = action)

---

### PR-R1-06: R1 Testing and Polish

**Scope**: Build new test suite for R1 features, fix any issues, performance verification.

**What this PR does**:

- Creates backend test suite from scratch (per D-R1-08):
  - Tenant isolation integration tests
  - Per-standard evaluation unit tests
  - Interpretation layer unit tests
  - Auth middleware unit tests
  - Preference API tests
  - Upload endpoint tests with standards parameter
- Creates frontend Vitest tests:
  - SiteOverviewCard, MetricCard, StandardSelector, MetricSelector tests
- Performance verification against PSD §17 SLAs

**Files affected (backend)**:

- `backend/tests/conftest.py` — New test fixtures
- `backend/tests/test_tenant_isolation.py` — New integration tests
- `backend/tests/test_per_standard_evaluation.py` — New unit tests
- `backend/tests/test_interpretation_layer.py` — New unit tests
- `backend/tests/test_auth_middleware.py` — New unit tests
- `backend/tests/test_preference_api.py` — New integration tests
- `backend/tests/test_upload_with_standards.py` — New integration tests

**Files affected (frontend)**:

- `frontend/tests/site-overview-card.test.tsx` — New test
- `frontend/tests/metric-card.test.tsx` — New test
- `frontend/tests/standard-selector.test.tsx` — New test
- `frontend/tests/metric-selector.test.tsx` — New test

**Dependencies**: PR-R1-05

**Acceptance criteria**:

- All backend tests pass (> 80% coverage target)
- All frontend tests pass (> 70% coverage target)
- Dashboard load time < 3 seconds
- CSV upload processing < 30 seconds
- API p95 response time < 500ms
- No regressions in existing functionality

---

### PR Dependency Graph

```
PR-R1-01 (Auth + Tenant)
    ↓
PR-R1-02 (Rulebook Reorg)
    ↓
PR-R1-03 (Schema Additions)
    ↓
PR-R1-04 (Backend API)
    ↓
PR-R1-05 (Frontend Refactor)
    ↓
PR-R1-06 (Testing + Polish)
```

### Migration Numbering Summary

| Migration | Purpose | Phase |
|-----------|---------|-------|
| 001-007 | Existing (core tables, QA, indexes, report_type, snapshot, zone_name, tenant customer info) | Pre-refactor |
| 008_site_context | Add context_scope and standard_ids to site | R1 |
| 009_scan_type | Add scan_type and standards_evaluated to upload | R1 |
| 010_site_metric_preferences | Create site_metric_preferences table | R1 |
| 011_site_standards | Create site_standards table | R1 |
| 012_device_connection | Create device_connection table | R2 |
| 013_alert_log | Create alert_log table | R2 |
| 014_user_tenant | Create user_tenant table | R1 |
| 015_rulebook_standard_link | Add reference_source_id FK to rulebook_entry | R1 |

## 6. Risks, Trade-offs, and Open Questions

### Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | Rulebook reorganization breaks existing evaluations | High — all historical findings reference old rule_version | Bump to "v2-refactor" without deleting v1.0 entries. Legacy findings remain queryable. |
| 2 | Tenant migration assigns sites incorrectly | Medium — facility managers see wrong data | Seed script uses deterministic logic. Manual review before production run. |
| 3 | Per-standard evaluation doubles query load | Medium — dashboard performance degradation | Index on (site_id, rule_version). Cache per-standard scores. |
| 4 | SafeSpace thresholds undefined at launch | Low — shows "Coming Soon" placeholder (intentional per PSD) | Acceptable. Jay/FJ team to define later. |
| 5 | Supabase Auth project confusion (same as existing or separate?) | **Resolved** — same project, middleware handles isolation | No action needed |
| 6 | Solo developer bandwidth | High — sequential delivery means longer timeline | Small PRs, each independently deployable. No parallel work needed. |

### Trade-offs

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| FJ staff no auth in R1 (D-R1-07) | Security vs. speed | Internal laptop access only. Auth added when customer portal ships. |
| PDF deferred to R3 (D-R1-06) | Feature completeness vs. delivery speed | Dashboard insights deliver value first. PDFs are documentation layer. |
| site_standards as separate table (D-R1-10) | Complexity vs. extensibility | Supports future metadata per standard (activation date, configured_by). |
| Old test suite deleted (D-R1-08) | Historical coverage vs. clean slate | Old tests covered compliance model; R1 tests purpose-built. |
| TEXT[] for active_metrics (D-R1-09) | Flexibility vs. simplicity | PostgreSQL arrays simpler than JSONB for flat enum lists. |

### Open Questions

| # | Question | Impact | Owner | Status |
|---|----------|--------|-------|--------|
| 1 | uHoo API access confirmed available? | Blocks R2 (continuous monitoring) | Jay | **Confirmed** — will proceed with R2 when ready |
| 2 | SafeSpace thresholds — when will Jay/FJ team define them? | Affects SafeSpace "Coming Soon" status in R1 | Jay | Placeholder UX — thresholds to be defined later |
| 3 | SS554 certification document — when will it be loaded? | Affects SS554 thresholds in R1 | Jay | Placeholder UX — cert doc to be loaded later |
| 4 | Supabase Auth project — same as existing (`jertvmbhgehajcrfifwl`) or separate? | Affects JWT secret and frontend SDK config | Jeff | **Resolved**: Same project — simpler config, tenant middleware handles isolation |
| 5 | Email sender address for alerts (R2)? | Needs domain verification with Resend | Jay | Use default Resend sender for now |
| 6 | How many facility managers expected in initial rollout? | Affects Supabase Auth billing tier | Jay | < 100 MAUs — free tier covers it |

### Critical Path for R1

The minimum viable R1 consists of PR-R1-01 through PR-R1-05.
PR-R1-06 (testing) is essential for production readiness but the dashboard
is functional after PR-R1-05. All blocking open questions have been
resolved — ready to begin PR-R1-01.
