# PR Plan: PR-R1-01 — Auth Foundation and Tenant Activation

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-01 has no prior PR dependencies (it is the first PR)
- **Scope boundaries**: Scope (in) = migration 014, seed script, config, dependencies.py, frontend auth. Scope (out) = tenant scoping enforcement on routes, user assignment UI
- **Risks**: Review risk #2 (tenant migration assigns sites incorrectly) — seed script is deterministic, manual review before prod
- **Status**: Verify no prior PRs are in progress or partially merged

**Post-Completion Check**: After merging, re-read ROADMAP.md to verify:

- All scope (in) items are delivered, scope (out) items are untouched
- Next PR (PR-R1-02) dependency is satisfied: sites have tenant_id assigned
- Update any open questions or risks if new issues surfaced

## 1) Assumptions

- Supabase Auth uses the same project (`jertvmbhgehajcrfifwl`) as existing Supabase database and storage.
- `SUPABASE_JWT_SECRET` is the Supabase project's JWT secret (Settings > API > JWT Settings).
- `SUPABASE_JWT_SECRET` is optional in R1 (FJ staff routes work without auth per D-R1-07). Becomes required in R2.
- `UserTenant` SQLModel already exists in `backend/app/models/supporting.py`.
- All existing sites have `tenant_id = NULL`.
- PyJWT will need to be added to backend dependencies.

## 1) Feature Summary

- **Goal**: Establish foundational authentication and tenant isolation layer
- **User Story**: As a facility manager, I want to log in and see only my site's data so that I can't accidentally access other tenants' information.
- **Acceptance Criteria**:
  1. `user_tenant` table exists with correct schema (supabase_user_id unique, tenant_id FK, role)
  2. Seed script creates "FJ Internal" tenant and assigns all NULL-tenant sites to it (idempotent)
  3. `GET /api/dashboard/sites` with no auth header returns all sites (backward compatible)
  4. `GET /api/dashboard/sites` with valid Supabase token returns tenant-scoped sites
  5. Invalid/expired JWT returns 401
  6. Frontend login page renders and sends magic link
  7. All existing frontend pages load without regression
- **Non-goals**: User assignment UI, tenant scoping enforcement on all routes (deferred to PR-R1-04), Clerk cleanup

## 2) Approach Overview

- **Proposed UX**: Simple login page with email input and "Send Magic Link" button. AuthProvider wraps layout to manage session state.
- **Proposed API**: Replace stub `get_tenant_id()` with Supabase JWT extraction. Returns None when no token present (backward compatible). New `get_current_tenant()` for routes that require auth (R2).
- **Proposed Data Changes**: New `user_tenant` table (migration 014). Seed script assigns existing sites to default tenant.

## 3) PR Plan

### PR Title: `feat(R1-01): auth foundation and tenant activation`
### Branch Name: `r1-01-auth-tenant`

### Key Changes by Layer

**Backend:**

1. **Migration 014_user_tenant** (`backend/migrations/versions/014_user_tenant.py`)
   - down_revision: `'007_tenant_customer_info'`
   - Create `user_tenant` table: id (String PK), supabase_user_id (String, unique, indexed), tenant_id (String FK tenant.id), role (String default 'facility_manager'), created_at
   - downgrade: drop_table('user_tenant')

2. **Seed script** (`scripts/seed_default_tenant.py`)
   - Check if "FJ Internal" tenant exists by tenant_name; create if not
   - Update sites where tenant_id IS NULL to point to default tenant
   - Print summary. Idempotent.
   - Follow pattern from `scripts/seed_rulebook_v1.py` (sys.path setup, Session/engine)

3. **Config** (`backend/app/core/config.py`)
   - Add `SUPABASE_JWT_SECRET: str | None = None` below SUPABASE_SERVICE_ROLE_KEY
   - Update comment from "Phase 3 -- Clerk auth" to "Supabase Auth JWT"

4. **Dependencies** (`backend/app/api/dependencies.py`)
   - Rewrite `get_tenant_id()` to: accept Request + Session deps, extract Authorization header, if none return None, if present decode JWT with PyJWT (HS256, verify aud="authenticated"), lookup user in user_tenant table, return tenant_id or None. Raise 401 on invalid token.
   - Add `get_current_tenant()` — same logic but requires valid token (raises 401 if no header)
   - Add `RequiredTenantIdDep = Annotated[str, Depends(get_current_tenant)]`

**Frontend:**

5. **Dependencies**: `pnpm add @supabase/supabase-js`. Remove `@clerk/nextjs` (optional, can be cleanup follow-up).

6. **Supabase client** (`frontend/lib/supabase.ts` — new)
   - Create and export singleton Supabase client using NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY

7. **AuthProvider** (`frontend/components/layout/AuthProvider.tsx` — new)
   - React context: user, session, signOut(), loading
   - On mount: `supabase.auth.getSession()`
   - Subscribe to `supabase.auth.onAuthStateChange`

8. **Login page** (`frontend/app/login/page.tsx` — new)
   - Client component with email input, "Send Magic Link" button
   - Uses `supabase.auth.signInWithOtp({ email })`
   - Success/error messages, redirect if already logged in

9. **Layout** (`frontend/app/layout.tsx`)
   - Wrap Navbar + main content with AuthProvider

10. **API client** (`frontend/lib/api.ts`)
    - Modify `fetcher` to accept optional authToken
    - When token provided, inject `Authorization: Bearer <token>` header
    - Export `api.withToken(token)` factory method

### Edge Cases to Handle

- Token present but user not in user_tenant table → return None (not 401, user exists but has no tenant)
- Token expired → decode fails → raise 401
- No Authorization header → return None (FJ staff, backward compatible)
- Malformed Authorization header → raise 401

## 4) Testing & Verification

### Automated Tests
- Unit test: `get_tenant_id()` with no header → returns None
- Unit test: `get_tenant_id()` with valid JWT, no user_tenant mapping → returns None
- Unit test: `get_tenant_id()` with valid JWT + mapping → returns tenant_id
- Unit test: `get_tenant_id()` with invalid JWT → raises 401
- Unit test: `get_current_tenant()` with no header → raises 401

### Manual Verification Checklist
1. `alembic upgrade head` succeeds, `user_tenant` table exists
2. `python scripts/seed_default_tenant.py` assigns NULL-tenant sites, idempotent
3. `GET /api/dashboard/sites` without auth returns all sites (same as before)
4. `/login` page renders, magic link sends email
5. All existing pages (`/`, `/ops`, `/executive`) load without regression

### Commands to Run
```bash
cd backend && alembic upgrade head
python scripts/seed_default_tenant.py
cd backend && fastapi dev app/main.py  # verify routes
cd frontend && pnpm dev  # verify UI
```

## 5) Rollback Plan

1. `alembic downgrade -1` (drops user_tenant table)
2. Revert `backend/app/api/dependencies.py` to original stub (`return None`)
3. Revert `backend/app/core/config.py` to remove SUPABASE_JWT_SECRET
4. Remove new frontend files: `lib/supabase.ts`, `components/layout/AuthProvider.tsx`, `app/login/page.tsx`
5. Revert `frontend/app/layout.tsx` to remove AuthProvider wrapper
6. Revert `frontend/lib/api.ts` to original
7. Delete `scripts/seed_default_tenant.py`
8. Undo tenant assignment: `UPDATE site SET tenant_id = NULL WHERE tenant_id = '<fj_internal_id>';`

## 6) Follow-ups

- Tenant scoping enforcement on dashboard routes (PR-R1-04)
- User assignment UI for onboarding facility managers (before R2)
- Remove @clerk/nextjs dependency and CLERK_SECRET_KEY config
- Configure Supabase Auth redirect URL for production deployment
- Make SUPABASE_JWT_SECRET required in R2
