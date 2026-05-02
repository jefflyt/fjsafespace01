# PR Plan: PR-R1-07 — Adhoc Customer Intake

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-07 builds on PR-R1-05 (frontend upload form) and PR-R1-06 (test infrastructure)
- **Scope boundaries**: Scope (in) = two-step upload flow (lookup → upload), customer search API, customer management page, tenant dedup by email. Scope (out) = Supabase Auth continuous monitoring (R2), PDF reports (R3)
- **Risks**: Verify PR-R1-05 frontend components are stable; verify upload endpoint test infrastructure from PR-R1-06 is in place
- **Status**: Verify PR-R1-05 and PR-R1-06 are merged

**Post-Completion Check**: After merging, re-read ROADMAP.md to verify:

- All scope (in) items are delivered
- Review open questions and update risks for R2 (uHoo API continuous monitoring)

## 1) Feature Summary

- **Goal**: Enable FJ staff to capture customer info during adhoc CSV uploads via a streamlined two-step flow (lookup → upload), creating identifiable tenant records that can later be converted to continuous monitoring contracts
- **User Story**: As FJ staff, I upload a CSV on behalf of a client. First I search for the customer by name or contact person — if found, I select them and proceed to upload. If not found, I register them with minimal info (client name + email). Over time, clients with multiple scans become candidates for continuous monitoring conversion via Supabase Auth invite.
- **User Impact**: Adhoc upload flow becomes two steps: (1) customer lookup/registration, (2) file upload. Customer info can be updated anytime via the admin page. First-upload friction is minimal — only 2 fields for new customers.
- **Acceptance Criteria**:
  1. Customer search by `client_name`, `contact_person`, or `site_address` → debounced results dropdown
  2. Selecting existing customer → locks `tenant_id`, proceeds to upload (file + standards only)
  3. New customer registration requires only `client_name` + `contact_email` (2 fields)
  4. `contact_email` is the dedup key — same email → same tenant reused
  5. Upload sends `tenant_id` (not individual fields) — cleaner endpoint contract
  6. `GET /api/tenants/search?q=` returns closest matches with highlight
  7. `GET /api/tenants` lists all customers with scan counts
  8. `PATCH /api/tenants/{id}` updates customer info inline
  9. Admin page at `/admin/customers` displays list + detail + inline edit
  10. All tests pass (backend + frontend)
- **Non-goals**: Continuous monitoring via uHoo API (R2), PDF report generation (R3), customer self-service portal UI

## 2) Approach Overview

### Business Model Context

Two distinct workflows coexist:

1. **Continuous monitoring (future R2)**: Supabase Auth → authenticated facility manager → uHoo API integration → real-time dashboard
2. **Adhoc scans (current)**: FJ staff manually upload CSV → creates/links tenant → processes scan → tenant becomes candidate for R2 conversion

The upload flow is redesigned as a **two-step process**:

**Step 1 — Customer Lookup (1 field):**

- FJ staff types into a search box (searches `client_name` OR `contact_person` OR `site_address`)
- Debounced API call → dropdown of closest matches
- Select match → `tenant_id` is locked, proceed to Step 2
- No match → click "Register new customer" → 2-field form (`client_name` + `contact_email`)

**Step 2 — Upload (2 fields):**

- File dropzone (CSV)
- Standards selector (chips)
- Upload button sends `tenant_id` + `file` + `standards`

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `contact_email` is dedup key (not `contact_person`) | Stable across name changes, spelling variations; maps directly to R2 Supabase Auth invite |
| Only 2 required fields for new customer | Minimizes first-upload friction while ensuring future identification |
| Search across 3 fields | FJ staff may remember client name, contact person, or location — any should work |
| `tenant_id` required on upload (not individual fields) | Cleaner API contract, separation of concerns |
| Customer management page | Allows updating info anytime without re-uploading |

## 3) PR Plan

### PR Title: `feat(R1-07): adhoc customer intake — two-step lookup, tenant dedup by email`

### Branch Name: `r1-07-customer-intake`

### Key Changes by Layer

**Backend:**

1. **Upload schemas** (`backend/app/schemas/upload.py` — new)
   - `UploadRequest`: `{ tenant_id, standards?, site_id? }`
   - `UploadResponse`: full response including `tenant_id`

2. **Tenant schemas** (`backend/app/schemas/tenant.py` — new)
   - `TenantSearchResult`: `{ id, client_name, site_address, contact_person, contact_email, match_score }`
   - `TenantSummary`: list response with `scan_count`, `site_count`
   - `TenantDetail`: detail response with upload history
   - `TenantUpdate`: PATCH request body (all fields optional)

3. **Upload endpoint** (`backend/app/api/routers/uploads.py:53-105` — modify)
   - Remove 4 individual customer fields from signature
   - Accept `tenant_id` (required, validated UUID) instead
   - Site creation: name = `"{client_name} — {site_address}"` if available, else filename
   - Response includes `tenant_id` for frontend tracking

4. **Tenants API** (`backend/app/api/routers/tenants.py` — new)
   - `GET /api/tenants/search?q=<text>`: Debounced search across `client_name`, `contact_person`, `site_address`. Returns top 10 matches sorted by relevance.
   - `GET /api/tenants`: List all tenants with scan counts (`scan_count`, `site_count`)
   - `GET /api/tenants/{tenant_id}`: Tenant details + upload history
   - `PATCH /api/tenants/{tenant_id}`: Update any customer fields (all optional)
   - `POST /api/tenants`: Create new tenant (minimal: `client_name` + `contact_email`)
   - Register router in `backend/app/main.py`

5. **Upload/tenant tests** (`backend/tests/test_upload_tenant_flow.py` — new)
   - `test_search_tenants_by_client_name`: Search finds matching tenants
   - `test_search_tenants_by_contact_person`: Search by contact person works
   - `test_upload_with_existing_tenant`: Upload with `tenant_id` links to existing tenant
   - `test_upload_creates_new_tenant`: Upload without `tenant_id` creates minimal tenant
   - `test_upload_dedupe_by_email`: Same `contact_email` → same tenant reused
   - `test_patch_tenant_updates_info`: PATCH updates customer fields

6. **Tenants API tests** (`backend/tests/test_tenants_api.py` — new)
   - `test_list_tenants_returns_all`: Returns all tenants with scan counts
   - `test_get_tenant_with_uploads`: Returns tenant details + upload history
   - `test_create_tenant_minimal`: POST with only `client_name` + `contact_email`
   - `test_create_tenant_unique_email`: Duplicate email → 409 Conflict

**Frontend:**

1. **CustomerLookup component** (`frontend/components/CustomerLookup.tsx` — new)
   - Search input with debounced API call (300ms debounce)
   - Dropdown showing matches: `client_name · site_address` with `contact_person` subtitle
   - "Register new customer" option at bottom of dropdown
   - On select: calls `onTenantSelected(tenantId)` callback

2. **UploadForm** (`frontend/components/UploadForm.tsx:33-256` — modify)
   - **Step 1**: Render `CustomerLookup` component. If tenant selected → show "Upload for [Client Name]?" confirmation, then Step 2. If "Register new customer" → show minimal 2-field form (`client_name` + `contact_email`), submit creates tenant, then proceed to Step 2.
   - **Step 2**: File dropzone + standards selector + upload button. FormData includes `tenant_id` (not individual fields).
   - State machine: `idle` → `looking_up` → `tenant_selected` | `registering` → `uploading` → `complete`

3. **CustomerManagement component** (`frontend/components/CustomerManagement.tsx` — new)
   - List view: Table with columns — Client Name, Site Address, Contact Person, Scans, Last Scan, Actions
   - Detail view (click row): Full info with inline-editable fields
   - Actions: "Edit", "Upload Scan", "View Scans"

4. **Admin customers page** (`frontend/app/admin/customers/page.tsx` — new)
   - Page header: "Customer Management"
   - Description: "Manage adhoc customers and their scan history. Customers with multiple scans can be converted to continuous monitoring in R2."
   - Renders `CustomerManagement` component

5. **API client** (`frontend/lib/api.ts` — modify)
   - Add `TenantSearchResult`, `TenantSummary`, `TenantDetail`, `TenantUpdate` TypeScript interfaces
   - Add `searchTenants(query)`, `getTenants()`, `getTenant(id)`, `createTenant(body)`, `updateTenant(id, body)` methods

6. **UploadForm tests** (`frontend/tests/upload-form.test.tsx` — new)
   - Search dropdown appears and shows matches
   - Selecting tenant proceeds to upload step
   - "Register new customer" shows 2-field form
   - Upload sends `tenant_id` in FormData
   - Form validates required fields

### Edge Cases to Handle

- Search query shorter than 2 chars → no API call, show hint
- No search results → show "No matches found. Register new customer?"
- Duplicate `contact_email` on tenant creation → 409 Conflict with "A customer with this email already exists" message
- Upload with invalid `tenant_id` → 404 "Customer not found"
- Tenant with many uploads (10+) → "View all scans" link to filter uploads by tenant

### Database Changes

**Migration**: Add UNIQUE constraint on `tenant.contact_email`

- Check existing data for duplicates first
- If duplicates exist, dedup by keeping most recent tenant (highest `created_at`)
- Migration file: `backend/migrations/versions/016_tenant_email_unique.py`

**No schema column changes needed** — `contact_email` already exists on `tenant` table from migration 007.

## 4) Testing & Verification

### Automated Tests

```bash
cd backend && pytest tests/test_upload_tenant_flow.py tests/test_tenants_api.py -v
cd frontend && pnpm test -- upload-form.test.tsx -v
```

### Manual Verification Checklist

1. Search by client name → dropdown shows matching tenants
2. Search by contact person → dropdown shows matching tenants
3. Select existing tenant → upload step shows tenant name, `tenant_id` is sent
4. Register new customer with 2 fields → tenant created, proceeds to upload
5. Upload CSV with `tenant_id` → linked to correct tenant
6. Upload second CSV with same `contact_email` → same tenant reused
7. Visit `/admin/customers` → see customer list with scan counts
8. Edit customer info inline → changes saved via PATCH
9. Run full test suite → no regressions

## 5) Rollback Plan

1. Revert `backend/app/api/routers/uploads.py` → restore previous signature
2. Delete `backend/app/api/routers/tenants.py` and unregister from `main.py`
3. Revert `frontend/components/UploadForm.tsx` → remove lookup step
4. Delete `frontend/components/CustomerLookup.tsx`, `frontend/components/CustomerManagement.tsx`, `frontend/app/admin/customers/page.tsx`
5. Drop UNIQUE constraint on `tenant.contact_email` (migration 016)

## 6) Post-Implementation Notes

### Files Modified/Created

- **Create**: `backend/app/schemas/upload.py`, `backend/app/schemas/tenant.py`, `backend/app/api/routers/tenants.py`, `backend/migrations/versions/016_tenant_email_unique.py`, `backend/tests/test_upload_tenant_flow.py`, `backend/tests/test_tenants_api.py`, `frontend/components/CustomerLookup.tsx`, `frontend/components/CustomerManagement.tsx`, `frontend/app/admin/customers/page.tsx`, `frontend/tests/upload-form.test.tsx`
- **Modify**: `backend/app/api/routers/uploads.py`, `backend/app/main.py`, `frontend/components/UploadForm.tsx`, `frontend/lib/api.ts`

### R2 Transition Path

Once a customer has accumulated multiple adhoc scans, FJ can use the customer management page to identify candidates for continuous monitoring. The R2 workflow would involve:

1. Select a tenant from the admin page
2. Click "Invite to Monitor" → sends email invitation to `contact_email`
3. Client creates Supabase Auth account using that email
4. `user_tenant` record created linking user to existing tenant
5. Configure uHoo API polling for their sites
6. Customer transitions from "adhoc" to "continuous monitoring" status
