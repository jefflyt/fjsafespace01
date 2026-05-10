# Epic Plan: R1 Refactor — Adhoc Scan Dashboard

## 1. Feature Summary

- **Objective**: Transform FJ SafeSpace Dashboard from compliance/reporting model to human-friendly IAQ wellness
dashboard with per-standard evaluation
- **User Impact**: Non-technical stakeholders can understand site health in under 30 seconds without knowing what raw
metrics mean
- **Dependencies**: Existing PR1-8 codebase (upload pipeline, Supabase schema, dashboard endpoints, TimeSeriesChart)

## 2. Complexity Assessment

- **Classification**: Multi-PR (8 PRs, sequential)
- **Estimated PR Count**: 10 (PR-R1-01 through PR-R1-11, PR-R1-06 pending)
- **Rationale**: Auth/tenant infrastructure must precede schema changes, which must precede API changes, which must
  precede frontend refactor, which must precede testing. Customer intake builds on the upload flow. Each layer
  depends on the previous. UI Refresh restructures navigation after all foundational work is complete.

## 3. Full-Stack Impact

- **Frontend**: New login page, auth provider, site overview card, metric cards, standard selector, metric selector,
threshold config dialog, zone detail view. Refactored /ops and /executive pages. UI Refresh: Scan Listing home, site scan results page, upload modal, role-aware Summary nav.
- **Backend**: Auth middleware, preferences API, standards API, interpretations API, enhanced upload/findings,
per-standard evaluation, tenant scoping.
- **Data**: 5 new migrations (008-011, 014-015), seed scripts for default tenant and rulebook reorganization.

## 4. PR Roadmap

### PR-R1-01: Auth Foundation and Tenant Activation — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr01-auth-tenant.md`
- **Goal**: Supabase Auth, user_tenant table, default tenant, JWT middleware
- **Scope (in)**: Migration 014, seed script, config, dependencies.py, frontend auth
- **Scope (out)**: Tenant scoping enforcement on routes, user assignment UI
- **Key Changes**: Replace auth stub, create user_tenant table, seed default tenant
- **Testing**: Unit tests for JWT extraction, manual auth flow verification
- **Dependencies**: None

### PR-R1-02: Rulebook Reorganization — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr02-rulebook-reorg.md`
- **Goal**: 4 certification standards (SS 554, WELL v2, RESET Viral Index,
  SafeSpace), link rules to sources, bump rule versions
- **Scope (in)**: Migration 015, seed script refactor, rule engine standard filter
- **Scope (out)**: Per-standard evaluation in API, frontend standard selector
- **Key Changes**: Add reference_source_id FK to rulebook_entry, reorganize rules by standard
- **Testing**: Manual verification of rule linking, API returns correct sources
- **Dependencies**: PR-R1-01 (sites must have tenant_id assigned)

### PR-R1-03: Schema Additions (Preferences, Standards, Context) — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr03-schema-additions.md`
- **Goal**: New tables for metric preferences, site standards, scan tracking
- **Scope (in)**: Migrations 008-011, SQLModel classes
- **Scope (out)**: API endpoints, frontend UI
- **Key Changes**: Create site_metric_preferences, site_standards tables, add columns to site/upload
- **Testing**: Manual schema verification, SQLModel import tests, migration column checks
- **Dependencies**: PR-R1-02 (reference_source table must exist for FK)

### PR-R1-04: Backend API (Enhanced Upload and New Endpoints) — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr04-backend-api.md`
- **Goal**: New API endpoints for preferences, standards, interpretations. Enhanced upload/findings.
- **Scope (in)**: All new API routes, schemas, aggregation service update
- **Scope (out)**: Frontend UI, rate limiting, uHoo API endpoints
- **Key Changes**: preferences router, interpretations router, enhanced upload, tenant scoping
- **Testing**: 15 tests pass against live Supabase (unit + integration)
- **Dependencies**: PR-R1-03 (schema tables must exist)

### PR-R1-05: Frontend Refactor (Human-Friendly Dashboard) — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr05-frontend-refactor.md`
- **Goal**: New components and refactored pages for human-friendly dashboard
- **Scope (in)**: 6 new components, refactored /ops and /executive pages, UploadForm update
- **Scope (out)**: PDF UI (R3), real-time charts (R2)
- **Key Changes**: SiteOverviewCard, MetricCard, StandardSelector, MetricSelector, ThresholdConfigDialog, ZoneDetailView
- **Testing**: Vitest component tests, manual UI verification
- **Dependencies**: PR-R1-04 (APIs must exist)

### PR-R1-06: R1 Testing and Polish

- **Plan**: `docs/plans/epics/R1-Refactor/pr06-testing-polish.md`
- **Goal**: Comprehensive test suite, performance verification
- **Scope (in)**: Backend tests (7 files), frontend tests (4 files), performance SLAs
- **Scope (out)**: E2E tests, CI/CD pipeline
- **Key Changes**: New test files, conftest fixtures
- **Testing**: pytest, Vitest, manual performance checks
- **Dependencies**: PR-R1-05 (components must exist)

### PR-R1-07: Adhoc Customer Intake

- **Plan**: `docs/plans/epics/R1-Refactor/pr07-adhoc-customer-intake.md`
- **Goal**: Capture customer info during adhoc uploads, create tenant records, enable conversion to continuous monitoring
- **Scope (in)**: Customer info fields on upload form, tenant creation/linking, tenants listing API, admin customer page
- **Scope (out)**: Supabase Auth continuous monitoring (R2), PDF reports (R3)
- **Key Changes**: Restore 4 client fields to UploadForm, tenant dedup by contact_person, `GET /api/tenants`, admin page
- **Testing**: Backend integration tests (tenant creation, dedup, listing), frontend form validation tests
- **Dependencies**: PR-R1-05 (UploadForm must exist)

### PR-R1-09: UI Refresh — Scan Results as Home — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr09-ui-refresh.md`
- **Goal**: Restructure navigation so scan results are the primary landing experience
- **Scope (in)**: Scan Listing home page, site scan results page, upload modal, role-aware Summary nav, backward redirects
- **Scope (out)**: Full auth integration, tenant user summary view, CM registration
- **Key Changes**: New routes `/` and `/sites/{siteId}`, enhanced dashboard/sites API, 5 new components, Sidebar added (fixed position, responsive overlay on mobile)
- **Testing**: Build passes, TypeScript passes, backend imports verified
- **Dependencies**: PR-R1-05 (components exist), PR-R1-08 (upload flow stable)

### PR-R1-10: Multi-Site CSV Upload Split — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr10-multi-site-csv.md`
- **Goal**: One CSV → multiple Upload records (one per physical site), grouped under UploadBatch
- **Scope (in)**: Two-phase upload (preview → zone assignment), UploadBatch table, new Site creation
- **Scope (out)**: Real-time device splitting, continuous monitoring
- **Key Changes**: UploadBatch model, zone extraction from CSV, zone assignment UI, split processing
- **Testing**: 132 backend tests pass, frontend build passes, migration 018 applied
- **Dependencies**: PR-R1-09 (upload modal exists)

### PR-R1-11: uHoo API Consistency Audit — ✅ COMPLETE

- **Plan**: `docs/plans/epics/R1-Refactor/pr11-api-consistency-audit.md`
- **Goal**: Align codebase with authoritative uHoo API reference (10 API metrics + 14 CSV metrics + virusIndex)
- **Scope (in)**: Add virus_index metric to enum + frontend config, document CO unit discrepancy (API ppm vs CSV ppb)
- **Scope (out)**: Direct uHoo API integration (R2+), usersettings-only field support
- **Key Changes**: `virus_index` in MetricName enum (15 total), METRIC_CONFIGS entry, UHOO_API_REFERENCE.md updated
- **Testing**: Enum has 15 metrics (verified), build passes, ruff lint passes
- **Dependencies**: None (documentation + config only)

## 5. Milestones & Sequence

```text
PR-R1-01 (Auth + Tenant)         → ✅ Complete (2026-04-28)
    ↓
PR-R1-02 (Rulebook Reorg)         → ✅ Complete (2026-04-28)
    ↓
PR-R1-03 (Schema Additions)       → ✅ Complete (2026-04-28)
    ↓
PR-R1-04 (Backend API)            → ✅ Complete (2026-04-28)
    ↓
PR-R1-05 (Frontend Refactor)      → ✅ Complete (2026-04-30)
    ↓
PR-R1-06 (Testing + Polish)       → In progress
    ↓
PR-R1-07 (Adhoc Customer Intake)  → ✅ Complete (merged with R1-08)
    ↓
PR-R1-08 (Upload Dedup)           → ✅ Complete (2026-05-02)
    ↓
PR-R1-09 (UI Refresh)              → ✅ Complete (2026-05-03)
    ↓
PR-R1-10 (Multi-Site CSV Split)    → ✅ Complete (2026-05-04)
    ↓
PR-R1-11 (API Consistency Audit)   → ✅ Complete (2026-05-04)
    ↓
Remaining estimated: R1-06 (Testing) + R2 (Continuous Monitoring)
```

## 6. Risks, Trade-offs, and Open Questions

### Risks

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| 1 | ~~Rulebook reorganization breaks existing evaluations~~ | ~~High~~ | ~~Bump to v2-refactor without deleting v1.0 entries~~ — ✅ Resolved by PR-R1-02 |
| 2 | Tenant migration assigns sites incorrectly | Medium | Seed script deterministic, manual review before prod — ✅ Resolved by PR-R1-01 |
| 3 | Per-standard evaluation doubles query load | Medium | Index on (site_id, rule_version), cache per-standard scores |
| 4 | Frontend refactor too large for single PR | Medium | Can split into components-first + pages-refactor if needed |

### Trade-offs

- **No auth for FJ staff in R1**: Speed over security for internal laptop access
- **PDF deferred to R3**: Dashboard insights deliver value first
- **Sequential PRs**: Solo developer — no parallel work possible
- **TEXT[] for active_metrics**: Simpler than JSONB for flat enum lists

### Open Questions (Resolved)

| | # | Question | Status | |
| | --- | ---------- | -------- | |
| | 1 | Supabase Auth project — same or separate? | ✅ Same project (PR-R1-01) | |
| | 2 | SafeSpace thresholds | ✅ Placeholder with draft status (PR-R1-02) | |
| | 3 | SS554 certification document | ✅ 4 approved rules seeded (PR-R1-02) | |
| | 4 | uHoo API access | ✅ Confirmed — R2 concern | |
| | 5 | Email sender address | ✅ Use default Resend sender | |
| | 6 | Facility manager count | ✅ < 100 MAUs — free tier covers | |
