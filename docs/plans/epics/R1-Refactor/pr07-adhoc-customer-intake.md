# PR Plan: PR-R1-07 — Adhoc Customer Intake

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-07 builds on PR-R1-05 (frontend upload form) and PR-R1-06 (test infrastructure)
- **Scope boundaries**: Scope (in) = customer info fields on upload, tenant creation flow, tenants listing API, admin customer page. Scope (out) = Supabase Auth continuous monitoring (R2), PDF reports (R3)
- **Risks**: Verify PR-R1-05 frontend components are stable; verify upload endpoint test infrastructure from PR-R1-06 is in place
- **Status**: Verify PR-R1-05 and PR-R1-06 are merged

**Post-Completion Check**: After merging, re-read ROADMAP.md to verify:

- All scope (in) items are delivered
- Review open questions and update risks for R2 (uHoo API continuous monitoring)

## 1) Feature Summary

- **Goal**: Capture basic customer information during adhoc CSV uploads so FJ can track and convert adhoc customers to continuous monitoring contracts
- **User Story**: As FJ staff, I upload a CSV on behalf of a client and provide their basic info (client name, site address, premises type, contact person) so the system creates a tenant record. Over time, clients with multiple scans become candidates for continuous monitoring conversion.
- **User Impact**: Adhoc upload flow now requires 4 customer info fields. Each upload creates or links to a tenant. FJ staff can review all adhoc customers via an admin page.
- **Acceptance Criteria**:
  1. Upload CSV with customer info → creates tenant + site, returns `tenant_id`
  2. Upload CSV with same `contact_person` twice → same tenant is reused (dedup)
  3. Upload CSV without customer info (no auth) → creates site only, `tenant_id` is null
  4. Authenticated user (tenant from JWT) → uses existing tenant, customer fields optional
  5. `GET /api/tenants` lists all tenants with scan counts
  6. `GET /api/tenants/{id}` shows tenant details with upload history
  7. Admin page at `/admin/tenants` displays customer list with scan counts
  8. All tests pass (backend + frontend)
- **Non-goals**: Continuous monitoring via uHoo API (R2), PDF report generation (R3), customer portal UI

## 2) Approach Overview

Two distinct workflows coexist:

1. **Continuous monitoring (future R2)**: Supabase Auth → authenticated facility manager → uHoo API integration
2. **Adhoc scans (current)**: FJ staff manually upload CSV → captures basic customer info → creates/links tenant record → processes scan

The 4 customer info fields (`client_name`, `site_address`, `premises_type`, `contact_person`) exist on the `tenant` table since migration 007. They were previously required on the upload form (PR9 era) then removed in R1-05. This PR restores them with a smarter approach: they are required for unauthenticated adhoc uploads but optional for authenticated users who already have a tenant.

## 3) PR Plan

### PR Title: `feat(R1-07): adhoc customer intake — capture client info on upload, tenant listing API`

### Branch Name: `r1-07-customer-intake`

### Key Changes by Layer

**Backend:**

1. **Upload schemas** (`backend/app/schemas/upload.py` — new)
   - `ClientInfo`: Pydantic model for the 4 required fields + 2 optional
   - `UploadResponse`: Full response schema including new `tenant_id` field

2. **Upload endpoint** (`backend/app/api/routers/uploads.py:53-105` — modify)
   - Restore `client_name`, `site_address`, `premises_type`, `contact_person` as optional form fields
   - When provided (adhoc flow): find existing tenant by `contact_person` or create new one
   - When absent with auth (JWT): use `TenantIdDep` tenant_id
   - When absent without auth: create site with null `tenant_id`
   - Response includes `tenant_id` for frontend tracking

3. **Tenants API** (`backend/app/api/routers/tenants.py` — new)
   - `GET /api/tenants`: List all tenants with scan counts (site_count, scan_count)
   - `GET /api/tenants/{tenant_id}`: Tenant details + upload history
   - Register router in `backend/app/main.py`

4. **Upload tests** (`backend/tests/test_upload_with_customer_info.py` — new)
   - `test_upload_with_client_info_creates_tenant`: Customer info → new tenant + site
   - `test_upload_without_client_info_creates_minimal_tenant`: No customer info → site only, null tenant
   - `test_upload_dedupe_same_contact_person`: Same contact_person → same tenant reused

5. **Tenants API tests** (`backend/tests/test_tenants_api.py` — new)
   - `test_list_tenants_returns_all`: Returns all tenants with scan counts
   - `test_get_tenant_with_uploads`: Returns tenant details + upload history

**Frontend:**

1. **UploadForm** (`frontend/components/UploadForm.tsx:33-256` — modify)
   - Add 4 input fields: client_name, site_address, premises_type (dropdown), contact_person
   - Form validation: all 4 fields required for upload button to be enabled
   - FormData includes customer fields on POST
   - Section labeled "Customer Information" between standards selector and dropzone

2. **TenantList component** (`frontend/components/TenantList.tsx` — new)
   - Fetches `GET /api/tenants`
   - Displays cards with client_name, site_address, premises_type, contact_person, scan_count, site_count
   - "View Details" button per row

3. **Admin tenants page** (`frontend/app/admin/tenants/page.tsx` — new)
   - Page header: "Customer Management"
   - Description: "Review adhoc customers for potential conversion to continuous monitoring"
   - Renders TenantList component

4. **API client** (`frontend/lib/api.ts` — modify)
   - Add `TenantSummary` and `TenantDetail` TypeScript interfaces
   - Add `getTenants()` and `getTenant(tenantId)` methods to apiClient

5. **UploadForm tests** (`frontend/tests/upload-form.test.tsx` — new)
   - Renders customer info fields
   - Requires all 4 fields before upload
   - Sends customer info in FormData on upload

### Edge Cases to Handle

- Upload with partial customer info (only 3 of 4 fields) → button disabled, clear error message
- Same contact_person with different client_name → update existing tenant with new info
- Upload with very long client_name or site_address → let PostgreSQL enforce max length (varchar)
- Tenant with many uploads (10+) → pagination or virtual scroll in tenant list (defer if < 100 tenants expected)

### Migration Check

No new migration needed — the `tenant` table already has all required columns from migration 007 (`client_name`, `site_address`, `premises_type`, `contact_person`, `specific_event`, `comparative_analysis`).

## 4) Testing & Verification

### Automated Tests

```bash
cd backend && pytest tests/test_upload_with_customer_info.py tests/test_tenants_api.py -v
cd frontend && pnpm test -- upload-form.test.tsx -v
```

### Manual Verification Checklist

1. Upload CSV with all 4 customer fields → tenant + site created, `tenant_id` returned
2. Upload second CSV with same `contact_person` → same `tenant_id`, same tenant updated
3. Upload CSV without customer fields (unauthenticated) → site created, `tenant_id` is null
4. Visit `/admin/tenants` → see list of customers with scan counts
5. Click a customer → see upload history
6. Run full test suite → no regressions

## 5) Rollback Plan

1. Revert `backend/app/api/routers/uploads.py` → restore previous simplified signature
2. Delete `backend/app/api/routers/tenants.py` and unregister from `main.py`
3. Revert `frontend/components/UploadForm.tsx` → remove customer info fields
4. Delete `frontend/app/admin/tenants/page.tsx` and `frontend/components/TenantList.tsx`
5. No database migration to revert

## 6) Post-Implementation Notes

### Files Modified/Created

- **Create**: `backend/app/schemas/upload.py`, `backend/app/api/routers/tenants.py`, `backend/tests/test_upload_with_customer_info.py`, `backend/tests/test_tenants_api.py`, `frontend/components/TenantList.tsx`, `frontend/app/admin/tenants/page.tsx`, `frontend/tests/upload-form.test.tsx`
- **Modify**: `backend/app/api/routers/uploads.py`, `backend/app/main.py`, `frontend/components/UploadForm.tsx`, `frontend/lib/api.ts`

### R2 Transition Path

Once a customer has accumulated multiple adhoc scans, FJ can use the tenants listing page to identify candidates for continuous monitoring. The R2 workflow would involve:

1. Select a tenant from the admin page
2. Create a Supabase Auth account for the client's facility manager
3. Link the user to the existing tenant via `user_tenant` table
4. Configure uHoo API polling for their sites
5. Customer transitions from "adhoc" to "continuous monitoring" status
