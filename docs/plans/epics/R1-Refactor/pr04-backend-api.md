# PR Plan: PR-R1-04 — Backend API (Enhanced Upload and New Endpoints)

**Status**: ✅ COMPLETE (2026-04-28)

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-04 depends on PR-R1-03 — schema tables must exist
- **Scope boundaries**: Scope (in) = all new API routes, schemas, aggregation service update.
  Scope (out) = frontend UI, rate limiting, uHoo API
- **Risks**: Review risk #3 (per-standard evaluation doubles query load) — index on (site_id, rule_version), cache
per-standard scores
- **Status**: ✅ PR-R1-03 is merged, all migrations applied (verified with column checks)

**Post-Completion Check**:

- ✅ All scope (in) items delivered, scope (out) items untouched
- ✅ Next PR (PR-R1-05) dependency satisfied: APIs exist for frontend to consume
- ✅ Tenant scoping tested: authenticated user sees only their tenant's sites

## 1) Assumptions

- All prior migrations (008-011, 014-015) applied. Schema tables exist.
- Auth middleware from PR-R1-01 in place (`TenantIdDep` returns tenant_id from JWT or None).
- Rule engine from PR-R1-02 can filter by standard_id.
- Current upload pipeline: `POST /api/uploads` parses CSV, stores readings, evaluates rules, creates findings.
- Current findings endpoint: `GET /api/uploads/{id}/findings` returns findings without standard_id.
- `api.py` fetcher in `frontend/lib/api.ts` already has generic get/post/patch/upload methods.

## 1) Feature Summary

- **Goal**: Add new API endpoints for metric preferences, standards management, interpretations. Enhance upload and
findings for per-standard evaluation.
- **User Story**: As the frontend, I need endpoints to manage site preferences and display per-standard evaluation
results so that users can customize their dashboard and see independent standard outcomes.
- **Acceptance Criteria**:
  1. ✅ `POST /api/uploads` accepts optional `standards` parameter (array of source IDs),
     stores `standards_evaluated`
     — [uploads.py:64](backend/app/api/routers/uploads.py#L64),
       [uploads.py:162](backend/app/api/routers/uploads.py#L162),
       [uploads.py:302](backend/app/api/routers/uploads.py#L302)
  2. ✅ `GET /api/uploads/{id}/findings` includes `standard_id` and `standard_title`
     per finding, supports `?standard_id=` filter
     — [uploads.py:350-476](backend/app/api/routers/uploads.py#L350-L476)
  3. ✅ `GET /api/sites/{id}/metric-preferences` returns active_metrics and threshold
     overrides (200, or 404 if site not found)
     — [preferences.py:36-71](backend/app/api/routers/preferences.py#L36-L71)
  4. ✅ `PATCH /api/sites/{id}/metric-preferences` validates metric names and threshold
     bounds (400 if invalid)
     — [preferences.py:74-183](backend/app/api/routers/preferences.py#L74-L183)
  5. ✅ `GET /api/sites/{id}/standards` returns active standards for site
     — [preferences.py:189-228](backend/app/api/routers/preferences.py#L189-L228)
  6. ✅ `POST /api/sites/{id}/standards/{source_id}/activate` and `/deactivate`
     work (204)
     — [preferences.py:231-300](backend/app/api/routers/preferences.py#L231-L300)
  7. ✅ `GET /api/interpretations/{metric_name}/{threshold_band}` returns
     human-readable text
     — [interpretations.py:25-98](backend/app/api/routers/interpretations.py#L25-L98)
  8. ✅ Dashboard routes apply tenant scoping via TenantIdDep (WHERE clause for
     facility managers)
     — [dashboard.py:30-42](backend/app/api/routers/dashboard.py#L30-L42),
       [dashboard.py:113-129](backend/app/api/routers/dashboard.py#L113-L129),
       [dashboard.py:132-159](backend/app/api/routers/dashboard.py#L132-L159),
       [dashboard.py:165-203](backend/app/api/routers/dashboard.py#L165-L203)
  9. ✅ Aggregation service computes per-standard wellness index
     — [aggregation.py:100-139](backend/app/services/aggregation.py#L100-L139)
- **Non-goals**: Frontend UI for these endpoints (deferred to PR-R1-05), rate limiting (TDD §4.4), uHoo API endpoints
(R2)

## 2) Approach Overview

- **Proposed API**: 3 new routers (preferences, standards, interpretations), enhanced upload/findings routers. All use
existing FastAPI patterns.
- **Proposed Backend**: New schemas, new service functions for preferences and interpretations, updated aggregation for
per-standard scoring.
- **Proposed Data**: No schema changes (all created in PR-R1-03).

## 3) PR Plan

### PR Title: `feat(R1-04): backend API for preferences, standards, and per-standard evaluation`

### Branch Name: `r1-04-backend-api`

### Implementation Status: ✅ COMPLETE

All 9 acceptance criteria verified against codebase. 15 automated tests pass
against live Supabase database. Migrations 008-015 applied and verified.

### Key Changes by Layer

**Backend:**

1. ✅ **Enhanced upload router** (`backend/app/api/routers/uploads.py`)
   - `POST /api/uploads`: Add optional `standards` field to form data (JSON array of source IDs)
   - If standards provided, evaluate against those sources. If omitted, use site's configured standards (SS554 default).
   - Store `standards_evaluated` on Upload record (array of source IDs used)
   - Response includes `standards_evaluated` field

2. ✅ **Enhanced findings endpoint** (`backend/app/api/routers/uploads.py`)
   - `GET /api/uploads/{id}/findings`: Add optional `?standard_id=` query param to filter
   - Each finding in response includes `standard_id` and `standard_title` (join with reference_source)

3. ✅ **Preferences router** (`backend/app/api/routers/preferences.py` — new)
   - `GET /api/sites/{id}/metric-preferences`: Query site_metric_preferences by site_id. If no row exists, return
defaults (empty active_metrics, empty overrides).
   - `PATCH /api/sites/{id}/metric-preferences`: Update active_metrics and alert_threshold_overrides. Validate:
     - Each metric in active_metrics is a valid MetricName enum value
     - Threshold overrides have numeric watch_max/watch_min/critical_max/critical_min fields
     - Threshold values fall within rulebook min_value/max_value bounds for that metric
   - Returns 400 if validation fails, 404 if site not found

4. ✅ **Standards router** (`backend/app/api/routers/preferences.py`)
   - `GET /api/sites/{id}/standards`: Query site_standards WHERE site_id = X, join reference_source for title
   - `POST /api/sites/{id}/standards/{source_id}/activate`: Insert or update site_standards row, set is_active = true
   - `POST /api/sites/{id}/standards/{source_id}/deactivate`: Set is_active = false
   - Returns 404 if site or source not found

5. ✅ **Interpretations router** (`backend/app/api/routers/interpretations.py` — new)
   - `GET /api/interpretations/{metric_name}/{threshold_band}`: Query rulebook_entry for the metric. Map threshold_band
to interpretation_template, business_impact_template, recommendation_template.
   - Accept optional `?context_scope=` query param (default "general")
   - Return interpretation, business_impact, recommendation, context_scope
   - Returns 404 if no rule found for metric

6. ✅ **Schema updates** (`backend/app/schemas/dashboard.py`)
   - Add `SiteMetricPreferencesResponse` schema
   - Add `SiteMetricPreferencesUpdate` schema (for PATCH body)
   - Add `SiteStandardsResponse` schema
   - Add `InterpretationResponse` schema

7. ✅ **Aggregation service update** (`backend/app/services/aggregation.py`)
   - Modify wellness index calculation to accept `standard_id` parameter
   - When standard_id provided, filter rules and findings by that standard
   - Return per-standard score, not just single score

8. ✅ **Dashboard routes tenant scoping** (`backend/app/api/routers/dashboard.py`)
   - All routes that accept `TenantIdDep` add WHERE tenant_id filter when tenant_id is not None
   - Cross-site comparison returns only tenant's sites for facility managers
   - Admin routes (no tenant_id) return all sites

9. ✅ **Register new routers** (`backend/app/main.py`)
   - `app.include_router(preferences_router, prefix="/api", tags=["preferences"])`
   - `app.include_router(interpretations_router, prefix="/api", tags=["interpretations"])`

**Frontend:**

1. ✅ **API client types** (`frontend/lib/api.ts`)
    - Add typed functions: `getSitesMetricPreferences()`, `updateSitesMetricPreferences()`,
`getSitesStandards()`, `activateStandard()`, `deactivateStandard()`, `getInterpretation()`
    - Keep existing unauthenticated functions

### Edge Cases to Handle

- PATCH metric-preferences with empty active_metrics → valid (means "show no metrics")
- PATCH with threshold override outside rulebook bounds → 400 with error message
- GET interpretations for metric with no rule → 404
- POST activate standard that's already active → idempotent (no error)
- Upload with standards=[] (empty array) → use site defaults
- Dashboard route with tenant_id=None → return all sites (FJ staff)
- Dashboard route with tenant_id set → return only that tenant's sites

## 4) Testing & Verification

### Manual Verification Checklist

1. ✅ `POST /api/uploads` with standards=[source_id] → upload succeeds, standards_evaluated stored
2. ✅ `GET /api/uploads/{id}/findings?standard_id=X` → returns only findings for that standard
3. ✅ `GET /api/sites/{id}/metric-preferences` → returns preferences object
4. ✅ `PATCH /api/sites/{id}/metric-preferences` with valid data → updates, returns 200
5. ✅ `PATCH /api/sites/{id}/metric-preferences` with invalid metric name → returns 400
6. ✅ `GET /api/interpretations/co2_ppm/WATCH` → returns interpretation text
7. ✅ Dashboard routes filter by tenant when tenant_id present

### Automated Tests

- ✅ 15 tests pass against live Supabase (9 unit + 6 integration)
- File: [test_r1_04_backend_api.py](backend/tests/test_r1_04_backend_api.py)

## 5) Rollback Plan

1. Revert all router changes (preferences.py, interpretations.py, uploads.py, dashboard.py)
2. Remove new schema classes from dashboard.py
3. Revert aggregation.py changes
4. Remove new routers from main.py
5. Note: No database changes — schema tables from PR-R1-03 remain but unused

## 6) Follow-ups

- Frontend UI for preferences, standards, interpretations (PR-R1-05)
- Rate limiting on upload endpoint (TDD §4.4)
- uHoo API device endpoints (R2)
- Email alert service (R2)
