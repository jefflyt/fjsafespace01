# PR-R1-09: UI Refresh — Scan Results as Home

## 1. Goal

Restructure the dashboard navigation so scan results are the primary landing experience. The home page becomes a site listing showing latest scan results, replacing the current Operations/Executive split.

## 2. Scope (In)

- New route: `/` — Scan Listing (one row per site, latest scan info)
- New route: `/sites/{siteId}` — Site Scan Results (all scans, standard selector, zone details)
- Upload flow as modal dialog from Scan Listing
- Role-aware "Summary" nav link (replaces separate Executive + Customers links)
- Backward-compatible redirects for `/ops` URLs
- Enhanced `GET /api/dashboard/sites` endpoint for site listing data

## 3. Scope (Out)

- Full Supabase Auth integration (design for it, defer implementation)
- Tenant user summary view (build FJ staff view only)
- Continuous Monitoring registration (future PR)
- PDF report UI (R3)

## 4. Key Changes

### Backend

- Enhance `GET /api/dashboard/sites` to return: site_name, tenant_name, latest_upload_date, scan_type, wellness_score, standard_scores, status

### Frontend Routes

| Route | Purpose |
|-------|---------|
| `/` | Scan Listing (new home) |
| `/sites/{siteId}` | Site Scan Results |
| `/executive` | Unchanged (FJ Staff Summary destination) |
| `/admin/customers` | Unchanged (accessible from Summary for FJ Staff) |
| `/ops/*` | Redirect to new routes |

### New Components

- `ScanListingTable` — data table for home page
- `ScanListingFilters` — search + scan type filter
- `UploadModal` — dialog wrapper for UploadForm
- `ScanHistoryTable` — historical scan list on site detail page

### Updated Components

- `Navbar` — new links (Scan Results, Summary), role-aware
- `UploadForm` — support modal embedding + redirect on complete

## 5. Dependencies

- PR-R1-05 (Frontend Refactor) — ✅ components exist
- PR-R1-08 (Upload Dedup) — ✅ upload flow stable

## 6. Testing

- Manual verification of all navigation flows
- `pnpm run build` passes
- TypeScript type-check passes
