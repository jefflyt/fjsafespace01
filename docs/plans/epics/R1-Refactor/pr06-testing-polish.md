# PR Plan: PR-R1-06 — R1 Testing and Polish

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-06 depends on PR-R1-05 — all components and pages must exist
- **Scope boundaries**: Scope (in) = backend tests (7 files), frontend tests (4 files), performance SLAs.
  Scope (out) = E2E tests, CI/CD pipeline
- **Risks**: Verify all prior PR risks have been mitigated during implementation
- **Status**: Verify PR-R1-05 is merged, all APIs and components are stable

**Post-Completion Check**: After merging, re-read ROADMAP.md to verify:

- All scope (in) items are delivered, scope (out) items are untouched
- R1 epic is complete — all 6 PRs delivered in sequence
- Review open questions and update risks for R2/R3 planning

## 1) Assumptions

- All prior PRs (R1-01 through R1-05) completed and merged.
- Backend has functional APIs for upload, preferences, standards, interpretations, dashboard.
- Frontend has all new components and refactored pages.
- Old test suite was deleted (D-R1-08) — building from scratch.
- `backend/tests/` exists but only has `__init__.py`.
- Frontend Vitest configured (`frontend/vitest.config.ts`).

## 1) Feature Summary

- **Goal**: Build comprehensive test suite for R1 features, verify performance SLAs, fix any issues
- **User Story**: As the developer, I need automated tests and performance validation so that I can confidently deploy R1 to production.
- **Acceptance Criteria**:
  1. All backend tests pass (> 80% coverage target)
  2. All frontend tests pass (> 70% coverage target)
  3. Dashboard load time < 3 seconds
  4. CSV upload processing < 30 seconds for files up to 10 MB
  5. API p95 response time < 500ms for dashboard queries
  6. No regressions in existing functionality (upload pipeline, readings, existing endpoints)
- **Non-goals**: E2E tests with Playwright (deferred), CI/CD pipeline (separate PR), load testing

## 2) Approach Overview

- **Proposed Tests**: Backend integration tests for tenant isolation, preferences, upload. Unit tests for rule engine, interpretations, auth middleware. Frontend component tests for new UI.
- **Proposed Backend**: New test files with conftest fixtures. Uses existing test patterns (db_session, client fixtures).
- **Proposed Frontend**: Vitest tests with jsdom + testing-library for new components.

## 3) PR Plan

### PR Title: `test(R1-06): comprehensive test suite and performance verification`
### Branch Name: `r1-06-testing`

### Key Changes by Layer

**Backend:**

1. **Test fixtures** (`backend/tests/conftest.py` — new/rebuild)
   - `db_engine`: In-memory SQLite or Docker PostgreSQL for tests
   - `db_session`: Session with rollback (test isolation)
   - `client`: FastAPI TestClient
   - `auth_token`: Helper to generate valid Supabase JWT for testing
   - `seed_data`: Helper to create test sites, tenants, reference_sources, rulebook entries

2. **Tenant isolation tests** (`backend/tests/test_tenant_isolation.py` — new)
   - Facility manager with valid token can only access their tenant's sites
   - Admin (no token) can access all sites
   - Cross-tenant data leakage prevention
   - Site metric preferences scoped to tenant
   - Standards management scoped to tenant

3. **Per-standard evaluation tests** (`backend/tests/test_per_standard_evaluation.py` — new)
   - Rule engine evaluates against single standard → correct findings
   - Rule engine evaluates against multiple standards → separate findings per standard
   - Wellness index calculation per standard → correct weighted score
   - SafeSpace placeholder → returns "Coming Soon" status, not a score
   - No applicable rules → returns INSUFFICIENT_EVIDENCE

4. **Interpretation layer tests** (`backend/tests/test_interpretation_layer.py` — new)
   - GET /api/interpretations/co2_ppm/WATCH → returns interpretation text
   - GET /api/interpretations with unknown metric → returns 404
   - Interpretation templates map correctly to threshold bands

5. **Auth middleware tests** (`backend/tests/test_auth_middleware.py` — new)
   - get_tenant_id() with no header → returns None
   - get_tenant_id() with valid JWT, no user_tenant mapping → returns None
   - get_tenant_id() with valid JWT + mapping → returns tenant_id
   - get_tenant_id() with invalid JWT → raises 401
   - get_current_tenant() with no header → raises 401

6. **Preference API tests** (`backend/tests/test_preference_api.py` — new)
   - GET metric-preferences → returns 200 with correct data
   - PATCH with valid data → updates, returns 200
   - PATCH with invalid metric name → returns 400
   - PATCH with threshold outside rulebook bounds → returns 400
   - PATCH on non-existent site → returns 404

7. **Upload with standards tests** (`backend/tests/test_upload_with_standards.py` — new)
   - POST /api/uploads with standards=[source_id] → stores standards_evaluated
   - POST /api/uploads without standards → uses site defaults
   - GET /api/uploads/{id}/findings?standard_id=X → filtered findings
   - Duplicate upload (same hash) → returns existing result

**Frontend:**

8. **SiteOverviewCard tests** (`frontend/tests/site-overview-card.test.tsx` — new)
   - Renders site name, last updated, scan mode indicator
   - Shows per-standard wellness scores with correct badges
   - Colour coding matches threshold bands
   - Top insight displayed

9. **MetricCard tests** (`frontend/tests/metric-card.test.tsx` — new)
   - Renders metric value, unit, interpretation text, action
   - Colour badge matches threshold_band
   - Multiple standards displayed correctly

10. **StandardSelector tests** (`frontend/tests/standard-selector.test.tsx` — new)
    - Renders list of active standards
    - Clicking standard updates selected state
    - Placeholder standards (SafeSpace) show "Coming Soon"

11. **MetricSelector tests** (`frontend/tests/metric-selector.test.tsx` — new)
    - Renders checkboxes for all metrics
    - Toggling checkbox calls API to persist preference
    - Loading state while saving

### Edge Cases to Handle

- Test with empty database → all endpoints return 404 or empty list
- Test with malformed JWT → 401
- Test with expired session token → 401
- Test with missing site → 404
- Test upload with CSV that has no data rows → error message

## 4) Testing & Verification

### Automated Tests
```bash
cd backend && pytest tests/ -v --cov=app --cov-report=term-missing
cd frontend && pnpm test -- --coverage
```

### Manual Verification Checklist
1. All backend tests pass, coverage > 80%
2. All frontend tests pass, coverage > 70%
3. Dashboard loads in < 3 seconds (measure with browser DevTools)
4. Upload 10MB CSV → processes in < 30 seconds
5. API response time < 500ms for GET /api/dashboard/sites (use curl or Postman)
6. No regressions: existing upload flow, readings, findings all work

### Performance Commands
```bash
# API response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/dashboard/sites

# Dashboard load time
# Use Chrome DevTools > Performance > record page load

# Upload processing time
time curl -X POST http://localhost:8000/api/uploads -F "file=@large_test.csv"
```

## 5) Rollback Plan

1. Revert all new test files — no production impact
2. Note: Tests are additive. No production code changes in this PR.

## 6) Follow-ups

- Playwright E2E tests (deferred per original plan)
- CI/CD pipeline with automated test execution
- Load testing for concurrent uploads
- Performance monitoring in production (Sentry, etc.)
