# Scan Data View — Design Spec

**Date**: 2026-05-12  
**Status**: Approved for planning

## 1. Goal

Insert a "Scan Data View" page between the upload flow and the certification results page. This page shows raw IAQ metrics as time-series data without any certification benchmark context, making it easy for non-technical customers to understand what their scan data shows before seeing how it compares to standards.

## 2. User Flow

```
Upload CSV → Scan Data View (/scan-data/{siteId}) → Scan Results (/sites/{siteId})
```

For multi-site uploads (PR-R1-10), the batch-level Scan Data View shows all zones together with zone filtering.

## 3. Page Layout (top to bottom)

1. **Breadcrumb + header**: `Scans > {Site Name} > Raw Data`, site name, scan count, scan date
2. **Metric summary strip**: 17 metrics showing latest value + status indicator (Good/Watch/Critical) — no standard names
3. **Metric tab cards**: Scrollable row of metric selector buttons (CO2, PM2.5, TVOC, etc.)
4. **Time-series chart area**: Reuses existing `TimeSeriesChart` component with zoom/pan enabled
5. **Zone filter**: Dropdown or pill buttons for multi-site batch views (All Zones, Zone 1, Zone 2...)
6. **Trend comparison bar**: Shows % change vs previous scan per metric (e.g., "CO2 ↓12%, PM2.5 ↑5%")
7. **Anomaly summary**: List of detected anomalies (spikes, drops, sensor gaps) from outlier detection
8. **Export actions**: Download CSV, Generate Summary PDF
9. **CTA button**: "View Certification Results →" links to `/sites/{siteId}`

## 4. Route Structure

| Route | Purpose |
|-------|---------|
| `/scan-data/{siteId}` | Scan Data View (new page) |
| `/scan-data/{siteId}?batchId={id}` | Batch-level view (multi-site upload) |
| `/sites/{siteId}` | Scan Results (existing, now certification-only) |

## 5. New Components

### 5.1 `ScanDataView` (page)

**Location**: `frontend/app/scan-data/[siteId]/page.tsx`

**Responsibilities**:
- Fetch readings and uploads for the site
- Build metric summary strip from latest readings
- Render metric selector, chart, zone filter, trend bar, anomaly list, export actions

**Data flow**:
- Calls `GET /api/uploads/{siteId}/readings` for time-series
- Calls `GET /api/uploads/{siteId}/findings` for anomaly detection (reuses existing outlier logic)
- Calls `GET /api/uploads?site_id={id}` for scan history (trend comparison)

### 5.2 `MetricSummaryStrip`

**Location**: `frontend/components/scan-data/MetricSummaryStrip.tsx`

**Responsibilities**:
- Horizontal strip of 17 metric cards showing: label, latest value, unit, colored status dot
- Status derived from existing `goodBand`/`watchBand`/`criticalBand` in `MetricConfig.ts`
- No certification standard references

### 5.3 `MetricTabSelector`

**Location**: `frontend/components/scan-data/MetricTabSelector.tsx`

**Responsibilities**:
- Scrollable horizontal tab bar for selecting which metric to display in the chart
- Reuses metric keys from `METRIC_CONFIGS`
- Active tab highlights the chart area

### 5.4 `TrendComparisonBar`

**Location**: `frontend/components/scan-data/TrendComparisonBar.tsx`

**Responsibilities**:
- Compares current scan metrics vs previous scan for the same site
- Shows % change with up/down arrows and color coding
- Falls back gracefully when no previous scan exists

### 5.5 `AnomalySummary`

**Location**: `frontend/components/scan-data/AnomalySummary.tsx`

**Responsibilities**:
- Lists detected anomalies from reading data (uses existing `is_outlier` flag)
- Groups by zone and metric
- Descriptive text for non-technical users (e.g., "CO2 spike detected in Zone 2 at 2:32 PM")

### 5.6 `ScanDataExport`

**Location**: `frontend/components/scan-data/ScanDataExport.tsx`

**Responsibilities**:
- Download CSV: regenerates the raw data for the current view
- Generate Summary PDF: simple one-page summary with key metrics and chart snapshot

## 6. Backend Changes

### 6.1 Enhanced Readings Endpoint

**Existing**: `GET /api/uploads/{id}/readings` returns `{ metrics: { metric_name: [Reading...] } }`

**Enhancement**: Add query params for:
- `?site_id={id}` — get readings for latest upload at site (needed for the new route)
- `?zone_name={name}` — filter by zone (for batch-level filtering)

### 6.2 Trend Comparison Endpoint (New)

**New**: `GET /api/uploads/{id}/trend-comparison`

Returns: `{ metrics: { metric_name: { current_avg, previous_avg, pct_change } } }`

Compares the latest upload's readings with the previous upload for the same site.

### 6.3 Anomaly Summary Endpoint (New)

**New**: `GET /api/uploads/{id}/anomalies`

Returns: `{ anomalies: [{ metric_name, zone_name, timestamp, type: "spike"|"drop"|"gap", value, description }] }`

Uses existing `is_outlier` flag and simple heuristic detection (sudden >2x changes between consecutive readings).

## 7. Reused Components

| Component | Source | Usage |
|-----------|--------|-------|
| `TimeSeriesChart` | `frontend/components/findings/TimeSeriesChart.tsx` | Main chart display with zoom/pan |
| `Sidebar` | `frontend/components/layout/Sidebar.tsx` | Navigation sidebar |
| `Card` | Shadcn UI | Container cards |
| `MetricConfig` | `frontend/components/findings/MetricConfig.ts` | Metric labels, units, bands |
| `apiClient` | `frontend/lib/api.ts` | API calls |

## 8. Data Source Strategy

### CSV Upload (this PR)
- Full 16 metrics available (14 sensor + 2 calculated: aqi_index, noise_dba)
- Time-series from reading timestamps within the CSV
- Multi-site batch support via UploadBatch

### Live uHoo API (R2 — separate page)
- 10 metrics (API provides fewer than CSV)
- virusIndex included (API-only)
- Separate `/live-monitoring` route planned for R2
- NOT included in this PR

## 9. Dependencies

- PR-R1-10 (Multi-Site CSV) — UploadBatch model, zone extraction
- PR-R1-09 (UI Refresh) — Sidebar, navigation structure
- PR-R1-11 (API Consistency) — virus_index metric in config
- Existing: TimeSeriesChart, MetricConfig, apiClient

## 10. Non-Goals (Out of Scope)

- Live uHoo API integration (separate page in R2)
- PDF report generation (R3)
- Real-time push updates (R2+)
- Mobile-specific responsive chart optimization (defer — use existing chart responsiveness)

## 11. Verification

- `pnpm dev` → navigate to `/scan-data/{siteId}` → all 17 metrics display correctly
- Chart zoom/pan works (mouse drag + scroll wheel)
- Zone filter shows/hides data correctly for multi-site batch
- Trend comparison shows correct % changes vs previous scan
- Anomaly summary correctly flags outliers
- CSV export downloads correct data
- "View Certification Results" navigates to `/sites/{siteId}`
- `pnpm build` passes
- TypeScript type-check passes
