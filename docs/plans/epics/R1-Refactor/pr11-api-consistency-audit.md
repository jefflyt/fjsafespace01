# PR-R1-11: uHoo API Consistency Audit

## Context

The uHoo API reference document ([docs/UHOO_API_REFERENCE.md](docs/UHOO_API_REFERENCE.md)) was corrected against the actual Postman collection and reveals discrepancies with the codebase. The API returns 10 metrics (including `virusIndex`), while CSV exports provide 16 metrics. This PR audits and aligns the codebase with the authoritative API reference.

## Audit Findings

### 1. Missing `virusIndex` Metric (Gap)

The uHoo API returns `virusIndex` (0-10, proprietary uHoo Virus Index score) in every `/v1/devicedata` response. This metric is **not** present anywhere in the codebase:
- Not in `MetricName` enum ([backend/app/models/enums.py:25-40](backend/app/models/enums.py#L25-L40))
- Not in `csv_parser.py` SENSOR_COLUMNS or COLUMN_ALIASES ([backend/app/skills/data_ingestion/csv_parser.py](backend/app/skills/data_ingestion/csv_parser.py))
- Not in frontend `METRIC_CONFIGS` ([frontend/components/findings/MetricConfig.ts](frontend/components/findings/MetricConfig.ts))

**Decision**: Add `virus_index` as a supported metric. It's part of the API and uHoo's key differentiator. However, since `virusIndex` does not appear in uHoo CSV exports (per API reference: "API provides 10 metrics vs 16 from CSV"), it will be added to the enum and frontend config but NOT to the CSV parser's COLUMN_ALIASES. It will be available for future direct API integration (R2+).

### 2. CO Unit Discrepancy (Documentation Only)

The uHoo API returns `co` in **ppm** (range 0-1000 ppm per `usersettings`), but the codebase uses `co_ppb` with range 0-1000 ppb. The CSV sample has CO values like 120, 130 which are consistent with ppb, not ppm (120 ppm CO would be lethal).

**Decision**: The CSV export provides CO in ppb, which is correct. The codebase is correct for CSV processing. The API unit difference (ppm vs ppb) is a future concern for direct API integration. Update the API reference doc to note this discrepancy and document that CSV CO is in ppb while API CO is in ppm (factor of 1000 conversion needed for future R2+ API integration).

### 3. PM2.5 Naming Inconsistency (Code Quality)

- API field: `pm25`
- Internal enum: `pm25_ugm3` ([enums.py:29](backend/app/models/enums.py#L29))
- CSV column: `pm2_5_ugm3` (used in csv_parser.py SENSOR_COLUMNS, COLUMN_ALIASES, OUTLIER_BOUNDS)
- METRIC_MAP bridges: `("pm2_5_ugm3", "pm25_ugm3", "μg/m³")` — CSV column → enum name

**Decision**: This is intentional — the METRIC_MAP translates the CSV column name to the enum name. The three-name scheme (CSV column → enum → API field) is working correctly. No changes needed.

### 4. OUTLIER_BOUNDS Match API Reference

| Metric | OUTLIER_BOUNDS | API Range | Status |
|---|---|---|---|
| co2_ppm | 300-5000 | 300-5000 | Match |
| temperature_c | -10 to 60 | -10 to 60 | Match |
| humidity_rh | 0-100 | 0-100 | Match |
| tvoc_ppb | 0-2000 | 0-2000 | Match |
| co_ppb | 0-1000 | 0-1000 (ppm in API) | Match (unit diff noted) |
| pressure_hpa | 870-1085 | 870-1085 (mbar in API) | Match (mbar = hPa) |
| o3_ppb | 0-300 | 0-300 | Match |
| no2_ppb | 0-500 | 0-500 | Match |
| pm25_ugm3 | 0-500 | 0-500 | Match |

All outlier bounds match the API reference ranges.

### 5. CSV-Only Metrics Correctly Absent from API

These 6 metrics are in the CSV parser but NOT in the API — this is expected and documented:
- `no_ppb` (nitric oxide) — CSV-only
- `voc_ppb` (individual VOC) — CSV-only
- `noise_dba` — CSV-only
- `pm10_ugm3` — CSV-only
- `aqi_index` — CSV-only (calculated)
- `pm2_5_ugm3` naming — see item 3

### 6. COLUMN_ALIASES Coverage

All 16 CSV alternate headers are mapped correctly. The `virusIndex` API metric has no CSV header to alias (it's API-only). This is correct.

## Plan

### Changes

1. **Add `virus_index` to `MetricName` enum** ([backend/app/models/enums.py](backend/app/models/enums.py))
   - Add `virus_index = "virus_index"` to the MetricName enum
   - Update docstring from "All 16 uHoo sensor metrics" to "All 17 uHoo sensor metrics (16 CSV + virusIndex from API)"

2. **Add `virus_index` to frontend `METRIC_CONFIGS`** ([frontend/components/findings/MetricConfig.ts](frontend/components/findings/MetricConfig.ts))
   - Add config: key "virus_index", label "Virus Index", symbol "VI", unit "" (proprietary), goodBand [0, 3], watchBand [[3, 6]], criticalBand [[6, 10]], yAxisDomain [0, 10]

3. **Update `UHOO_API_REFERENCE.md`** ([docs/UHOO_API_REFERENCE.md](docs/UHOO_API_REFERENCE.md))
   - Add note about CO unit discrepancy (API: ppm, CSV: ppb, conversion factor 1000)
   - Clarify that `virusIndex` is API-only and not in CSV exports

### Non-Changes (verified correct, no action needed)
- `csv_parser.py` SENSOR_COLUMNS, COLUMN_ALIASES, OUTLIER_BOUNDS, METRIC_MAP — all correct
- `frontend/components/findings/MetricConfig.ts` existing configs — all match API ranges
- `backend/app/models/enums.py` existing metrics — all correct
- No stale API parameter references found in codebase

### Files to Touch
| File | Action |
|---|---|
| `backend/app/models/enums.py` | Add `virus_index` to MetricName enum, update docstring |
| `frontend/components/findings/MetricConfig.ts` | Add virus_index config |
| `docs/UHOO_API_REFERENCE.md` | Add CO unit discrepancy note |

## Verification

- [ ] Backend: `cd backend && python -c "from app.models.enums import MetricName; print([m.name for m in MetricName])"` — verify 17 metrics listed
- [ ] Frontend: `cd frontend && pnpm run build` — build passes with new metric config
- [ ] Frontend: `cd frontend && pnpm run type-check` — TypeScript passes
- [ ] Manual: Check that virus_index appears in MetricSelector dropdown on /ops page

## Rollback Plan

Revert the 3-file change. No data migration or schema changes involved.

## Follow-ups

- Future R2+ direct API integration: map `virusIndex` from API responses, handle CO unit conversion (ppm → ppb × 1000)
- Consider whether `usersettings`-only fields (pm1, pm4, ch2o/formaldehyde, light, sound) should be added as stub metrics for future device support
