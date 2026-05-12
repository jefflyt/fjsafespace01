# PR-R1-09: UI Refresh — Scan Results as Home

## 1. Goal

Restructure the dashboard navigation so scan results are the primary landing experience. The home page becomes a site listing showing latest scan results, replacing the current Operations/Executive split.

## 2. Scope (In) — ✅ COMPLETE

- [x] New route: `/` — Scan Listing (one row per site, latest scan info)
- [x] New route: `/sites/{siteId}` — Site Scan Results (all scans, standard selector, zone details)
- [x] Upload flow as modal dialog from Scan Listing
- [x] Role-aware "Summary" nav link (replaces separate Executive + Customers links)
- [x] Backward-compatible redirects for `/ops` URLs
- [x] Enhanced `GET /api/dashboard/sites` endpoint for site listing data
- [x] Dynamic sidebar scan count (fetches from API, no hardcoded value)
- [x] WATCH outcome band properly mapped (was falling through to INSUFFICIENT_EVIDENCE)
- [x] `scan_date` field added to uploads — derives from CSV reading timestamps, not upload time
- [x] Executive dashboard uses `scan_date` instead of `Finding.created_at` for last_scan_date

## 3. Scope (Out)

- Full Supabase Auth integration (design for it, defer implementation)
- Tenant user summary view (build FJ staff view only)
- Continuous Monitoring registration (future PR)
- PDF report UI (R3)

## 4. Key Changes

### Backend

- [x] Enhance `GET /api/dashboard/sites` to return: site_name, tenant_name, latest_upload_date, scan_type, wellness_score, standard_scores, status
- [x] Add `site_id` query filter to `GET /api/uploads`
- [x] Add `scan_date` field to Upload model (migration 021) — derived from `MIN(reading_timestamp)` per upload
- [x] Update `GET /api/uploads` to include `scan_date` in response
- [x] Update aggregation service to use `upload.scan_date` for `last_scan_date` (was using `Finding.created_at`)

### Frontend Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Scan Listing (new home) | ✅ |
| `/sites/{siteId}` | Site Scan Results | ✅ |
| `/executive` | Unchanged (FJ Staff Summary destination) | ✅ |
| `/admin/customers` | Unchanged (accessible from nav) | ✅ |
| `/ops/*` | Redirect to new routes | ✅ |

### New Components

- [x] `ScanListingTable` — data table for home page
- [x] `ScanListingFilters` — search + scan type filter
- [x] `UploadModal` — dialog wrapper for UploadForm
- [x] `ScanHistoryTable` — historical scan list on site detail page
- [x] `RegisterCustomerModal` — customer registration dialog

### Updated Components

- [x] `Navbar` — new links (Scan Results, Summary, Customers), role-aware
- [x] `UploadForm` — support modal embedding + redirect on complete
- [x] `Sidebar` — added (fixed position, responsive overlay on mobile, used by all pages)

## 5. Dependencies

- PR-R1-05 (Frontend Refactor) — ✅ components exist
- PR-R1-08 (Upload Dedup) — ✅ upload flow stable

## 6. Testing

- [x] Manual verification of all navigation flows
- [x] `pnpm run build` passes
- [x] TypeScript type-check passes
- [x] Backend imports verified

## 7. Status

**✅ COMPLETE** — 2026-05-03

### Commits

1. `92a4b07f` feat(R1-09): UI Refresh — scan results as home page
2. `0d1d4054` fix(R1-09): outcomeBadge enum mapping to match CertificationOutcome

### Files Changed (15)

- **Backend**: `dashboard.py`, `uploads.py`, `aggregation.py`, `models/workflow_b.py`, `migrations/versions/021_upload_scan_date.py`
- **Frontend**: `page.tsx`, `ops/page.tsx`, `sites/[siteId]/page.tsx`, `Navbar.tsx`, `api.ts`, `constants.ts`, `layout/Sidebar.tsx`, `ScanListingTable.tsx`, `ScanListingFilters.tsx`, `UploadModal.tsx`, `ScanHistoryTable.tsx`, `RegisterCustomerModal.tsx`, `Sidebar.tsx`
- **Docs**: `CLAUDE.md`, `SCHEMA_REFERENCE.md`, `pr09-ui-refresh.md`

### Known Notes

- N+1 query pattern in `get_sites` (one query per site for tenant/upload lookup) — acceptable at current scale (~5 sites), should optimize if sites grow beyond ~50
- ScanHistoryTable `onRowClick` logs to console — future enhancement to load specific upload findings
- "Customers" nav link retained for quick access to admin customer management (deviation from original "Summary-only" concept)
- **scan_date vs uploaded_at**: All date displays now use `scan_date` (CSV reading timestamp). `uploaded_at` is no longer displayed anywhere. Migration 021 added the field; existing data was backfilled from `reading` table.
- **WATCH outcome**: Added `WATCH` as a distinct outcome in `OUTCOME_CONFIG` (amber/yellow). Previously mapped to `INSUFFICIENT_EVIDENCE`, causing mixed GOOD+WATCH findings to show incorrectly.
