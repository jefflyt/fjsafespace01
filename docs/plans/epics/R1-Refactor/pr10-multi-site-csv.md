# PR-R1-10: Multi-Site CSV Upload Split — ✅ COMPLETE

## Context

Real-world CSV uploads from uHoo devices can contain readings from multiple physical sites (e.g., NPE POD + Outside POD). Currently the system creates one Upload record and one Site per CSV, regardless of how many physical sites the data spans. This means two physically separate sites get lumped into one certification evaluation — incorrect for reporting.

**Outcome:** One CSV → multiple independent Upload records (one per resulting site), grouped under a parent UploadBatch for traceability.

**Status**: ✅ Complete (2026-05-04)

## Design Adjustments from Plan

- **Universal batch model**: ALL uploads (single-zone and multi-zone) create UploadBatch + child Upload(s), not just multi-zone. This ensures consistent data structure and traceability.
- **Migration 018**: Used instead of the plan's placeholder "016_...py" since 017 was already in use for content_hash.
- **Content hash dedup**: Checked in both preview endpoint AND existing upload endpoint, with force flag bypass.

## Decisions

- **Split is user-specified at upload time** — the system detects distinct zone names from the CSV, user assigns each zone to an existing site or creates a new one.
- **Parent-child model** — `UploadBatch` (one per CSV file) → N child `Upload` records (one per site).
- **Both CSV formats supported** — Hourly Averages and Min-by-Min from uHoo.
- **Auto-create new sites** for zones not matching existing tenant sites.
- **Content hash dedup at batch level** — prevents re-uploading the same CSV.

## Design

### Data Flow

```text
1. POST /uploads/preview — parse CSV, extract distinct zone names
   Response: { zones: ["Lobby", "Outside Entrance", "Meeting Room A"] }

2. Frontend shows zone assignment UI — user maps each zone to:
   - existing site (dropdown of tenant's sites)
   - new site (text input for name)

3. POST /uploads/confirm — send zone mapping
   Backend:
   - Creates UploadBatch record
   - Splits CSV data by zone assignment
   - Creates N child Upload records (one per site group)
   - Creates new Site records where needed
   - Processes each child upload: readings, findings, wellness score
```

### Database Changes

**New table: `upload_batch`**

```sql
CREATE TABLE upload_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID REFERENCES tenant(id),  -- nullable
    content_hash TEXT NOT NULL,            -- SHA-256 for dedup
    child_upload_ids TEXT[]                -- JSON array of child upload UUIDs
);
```

**Extended table: `upload`**

```sql
ALTER TABLE upload ADD COLUMN batch_id UUID REFERENCES upload_batch(id);
ALTER TABLE upload ADD COLUMN zone_list TEXT[];
```

- `batch_id` is nullable — backward compatible with existing uploads
- `zone_list` stores which zones this upload covers

### Backend Files

| File | Change | Status |
|---|---|---|
| `backend/app/models/workflow_b.py` | Add `UploadBatch` model, extend `Upload` with `batch_id`, `zone_list` | ✅ Done |
| `backend/migrations/versions/018_upload_batch_multi_site.py` | Create `upload_batch` table, add columns to `upload` | ✅ Done |
| `backend/app/api/routers/uploads.py` | Add `POST /uploads/preview`, add `POST /uploads/confirm`, refactor existing `POST /uploads` to use batch model | ✅ Done |
| `backend/app/skills/data_ingestion/csv_parser.py` | Add `extract_zones(file: IO[bytes]) -> list[str]` function | ✅ Done |

### Frontend Files

| File | Change | Status |
|---|---|---|
| `frontend/components/UploadForm.tsx` | Convert to multi-step: preview → zone assignment (multi-zone) or direct upload (single-zone) | ✅ Done |
| `frontend/components/ZoneAssignment.tsx` | New component — zone list + site dropdown + new site input + grouped summary | ✅ Done |
| `frontend/lib/api.ts` | Add `previewUpload()` and `confirmUpload()` typed methods | ✅ Done |
| `frontend/components/UploadModal.tsx` | Handle batch results, redirect to first child site | ✅ Done |
| `frontend/app/page.tsx` | Upload flow via UploadModal (already wired from R1-09) | ✅ No change needed |

### API Contracts

#### POST /uploads/preview

```text
Request: multipart/form-data with `file` (CSV)
Response: { zones: string[] }
```

#### POST /uploads/confirm

```text
Request: multipart/form-data with:
  - file: CSV
  - tenant_id: optional string
  - zone_mapping: JSON string, e.g.
    { "Lobby": "existing-site-uuid", "Outside Entrance": "__new__:Outside POD" }

Response: {
  batch_id: string,
  children: [
    { upload_id, site_id, site_name, finding_count, ... },
    ...
  ]
}
```

### Backwards Compatibility

- Existing `POST /uploads` endpoint retained for single-site uploads (no zone mapping provided → behaves as today)
- `batch_id` nullable on Upload — old records unaffected
- `GET /api/uploads` unchanged — returns all uploads regardless of batch

### Dedup Interaction

- Content hash lives on `UploadBatch`, not individual `Upload`
- Dedup check happens at preview time: if hash matches existing batch, warn user
- Force flag bypasses dedup (same as current behavior)

## Verification

1. Upload single-zone CSV → creates UploadBatch with 1 child upload (universal batch model) ✅ Implemented
2. Upload multi-zone CSV, assign zones to existing sites → creates batch with N child uploads ✅ Implemented
3. Upload multi-zone CSV, create new sites → creates batch, new sites, and N child uploads ✅ Implemented
4. Re-upload same CSV → dedup warning shown at preview ✅ Implemented
5. Both Hourly Averages and Min-by-Min formats work identically ✅ extract_zones uses COLUMN_ALIASES normalization
6. Frontend build passes, TypeScript check passes ✅ pnpm build + tsc --noEmit exit 0
7. Backend tests pass ✅ 132/132 passed
