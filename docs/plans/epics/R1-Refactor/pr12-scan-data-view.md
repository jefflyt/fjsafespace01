# PR-R1-12: Scan Data View — Raw Metrics Before Certification

## 1. Goal

Insert a "Scan Data View" page between the upload flow and certification results. This page shows all IAQ metrics as time-series data without any certification benchmark context, making it easy for non-technical customers to understand raw scan data before seeing how it compares to standards.

**Flow**: Upload Scan Data → Scan Data View → Scan Results (certification benchmarks)

## 2. Scope (In)

- [ ] New route: `/scan-data/{siteId}` — Scan Data View page
- [ ] New route: `/scan-data/{siteId}?batchId={id}` — Batch-level multi-site view
- [ ] Metric summary strip (17 metrics, latest value + Good/Watch/Critical status, no standard names)
- [ ] Metric tab selector (scrollable horizontal tabs for switching chart metrics)
- [ ] Time-series chart with zoom/pan (reuses existing `TimeSeriesChart` component)
- [ ] Zone filter (dropdown/pill buttons for multi-site batch views)
- [ ] Trend comparison bar (% change vs previous scan per metric)
- [ ] Anomaly summary (outlier detection from existing `is_outlier` flag)
- [ ] Export actions (download CSV, generate summary PDF)
- [ ] "View Certification Results" CTA → navigates to `/sites/{siteId}`
- [ ] Enhanced readings endpoint: `?site_id=` and `?zone_name=` query params
- [ ] New backend endpoint: `GET /api/uploads/{id}/trend-comparison`
- [ ] New backend endpoint: `GET /api/uploads/{id}/anomalies`
- [ ] Restructure existing `/sites/{siteId}` page: remove raw chart display, focus on certification

## 3. Scope (Out)

- Live uHoo API integration (separate `/live-monitoring` page — R2)
- Real-time push updates (R2+)
- PDF report generation (R3)
- Mobile-specific chart optimization (defer — use existing responsiveness)

## 4. Key Changes

### Backend

- [ ] Enhance `GET /api/uploads/{id}/readings` to support `?site_id={id}` (get readings for latest upload at site) and `?zone_name={name}` (filter by zone)
- [ ] New endpoint: `GET /api/uploads/{id}/trend-comparison` — compares latest upload readings vs previous upload for same site, returns `{ metrics: { metric_name: { current_avg, previous_avg, pct_change } } }`
- [ ] New endpoint: `GET /api/uploads/{id}/anomalies` — returns detected anomalies from outlier flag + heuristic detection, format: `{ anomalies: [{ metric_name, zone_name, timestamp, type, value, description }] }`
- [ ] Add `GET /api/uploads/latest?site_id={id}` or enhance existing upload listing to return latest upload ID for a site (needed by the new route)

### Frontend Routes

| Route | Purpose |
|-------|---------|
| `/scan-data/{siteId}` | Scan Data View (new page) |
| `/scan-data/{siteId}?batchId={id}` | Batch-level multi-site view |
| `/sites/{siteId}` | Scan Results — certification benchmarks (existing, refactored) |

### New Components

- [ ] `ScanDataView` page — `frontend/app/scan-data/[siteId]/page.tsx`
- [ ] `MetricSummaryStrip` — `frontend/components/scan-data/MetricSummaryStrip.tsx`
  - Horizontal strip of 17 metric cards: label, latest value, unit, colored status dot
  - Status derived from `goodBand`/`watchBand`/`criticalBand` in `MetricConfig.ts`
- [ ] `MetricTabSelector` — `frontend/components/scan-data/MetricTabSelector.tsx`
  - Scrollable horizontal tab bar for selecting active metric
  - Reuses `METRIC_CONFIGS` keys
- [ ] `TrendComparisonBar` — `frontend/components/scan-data/TrendComparisonBar.tsx`
  - Shows % change vs previous scan with up/down arrows
  - Graceful fallback when no previous scan exists
- [ ] `AnomalySummary` — `frontend/components/scan-data/AnomalySummary.tsx`
  - Lists detected anomalies grouped by zone and metric
  - Plain-language descriptions (e.g., "CO2 spike detected in Zone 2 at 2:32 PM")
- [ ] `ScanDataExport` — `frontend/components/scan-data/ScanDataExport.tsx`
  - Download CSV (raw data for current view)
  - Generate Summary PDF (one-page summary with key metrics and chart snapshot)

### Updated Components

- [ ] `UploadModal` — redirect to `/scan-data/{siteId}` after upload complete (instead of `/sites/{siteId}`)
- [ ] `/sites/{siteId}` page — remove raw chart display, focus on certification standards, wellness index, zone analysis
- [ ] `Sidebar` — add "Raw Data" nav link (optional, or keep accessible via upload flow only)

### Reused Components

| Component | Source | Usage |
|-----------|--------|-------|
| `TimeSeriesChart` | `frontend/components/findings/TimeSeriesChart.tsx` | Main chart display with zoom/pan |
| `Sidebar` | `frontend/components/layout/Sidebar.tsx` | Navigation sidebar |
| `MetricConfig` | `frontend/components/findings/MetricConfig.ts` | Metric labels, units, bands |
| `apiClient` | `frontend/lib/api.ts` | API calls |

## 5. Data Flow

```
User uploads CSV
  → UploadModal confirms upload
  → Redirects to /scan-data/{siteId}?batchId={batchId}
  → Page fetches readings + findings for latest upload
  → Shows time-series chart + metric summary
  → User can filter by zone, switch metrics, view trends
  → Click "View Certification Results" → /sites/{siteId}
```

## 6. Dependencies

- PR-R1-10 (Multi-Site CSV Upload Split) — UploadBatch model, zone extraction
- PR-R1-09 (UI Refresh) — Sidebar, navigation structure
- PR-R1-11 (API Consistency Audit) — virus_index metric in config
- Existing: `TimeSeriesChart`, `MetricConfig`, `apiClient`

## 7. Testing

- [ ] Manual verification: upload CSV → redirected to Scan Data View → all 17 metrics display
- [ ] Chart zoom/pan works (mouse drag + scroll wheel)
- [ ] Zone filter correctly shows/hides data for multi-site batch
- [ ] Trend comparison shows correct % changes vs previous scan
- [ ] Anomaly summary correctly flags outliers with plain-language descriptions
- [ ] CSV export downloads correct data
- [ ] "View Certification Results" navigates to `/sites/{siteId}` correctly
- [ ] `pnpm run build` passes
- [ ] TypeScript type-check passes
- [ ] Backend endpoint tests (trend-comparison, anomalies)

## 8. Status

**⏳ PLANNED**

## 9. Files to Modify/Create

### New Files
- `frontend/app/scan-data/[siteId]/page.tsx`
- `frontend/components/scan-data/MetricSummaryStrip.tsx`
- `frontend/components/scan-data/MetricTabSelector.tsx`
- `frontend/components/scan-data/TrendComparisonBar.tsx`
- `frontend/components/scan-data/AnomalySummary.tsx`
- `frontend/components/scan-data/ScanDataExport.tsx`
- `backend/app/api/routers/scan_data.py` (or add to existing uploads router)

### Modified Files
- `frontend/app/sites/[siteId]/page.tsx` — remove raw chart, focus on certification
- `frontend/components/UploadModal.tsx` — redirect to `/scan-data/{siteId}`
- `backend/app/api/routers/uploads.py` — add trend-comparison, anomalies endpoints
- `frontend/lib/api.ts` — add new API client methods

## 10. Known Notes

- The 17 metrics include 2 calculated fields (aqi_index, noise_dba) that may not have time-series data — handle gracefully with "no data" state
- Trend comparison needs at least 2 uploads for the same site — show "No comparison data" when only one scan exists
- Anomaly detection reuses existing `is_outlier` flag from the reading table — no new detection logic needed for MVP
- Batch-level view aggregates readings across all uploads in the batch, filterable by zone
- Live uHoo API integration will be a separate page (`/live-monitoring`) in R2 — this page is CSV-only
