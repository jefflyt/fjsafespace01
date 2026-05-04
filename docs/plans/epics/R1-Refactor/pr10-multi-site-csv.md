# PR-R1-10: Multi-Site CSV Upload Split

## Context

Real-world CSV uploads from uHoo devices can contain readings from multiple physical sites (e.g., NPE POD + Outside POD). Currently the system creates one Upload record and one Site per CSV, regardless of how many physical sites the data spans. This means two physically separate sites get lumped into one certification evaluation — incorrect for reporting.

**Outcome:** One CSV → multiple independent Upload records (one per resulting site), grouped under a parent UploadBatch for traceability.

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

| File | Change |
|---|---|
| `backend/app/models/workflow_b.py` | Add `UploadBatch` model, extend `Upload` with `batch_id`, `zone_list` |
| `backend/migrations/versions/016_...py` | Create `upload_batch` table, add columns to `upload` |
| `backend/app/api/routers/uploads.py` | Add `POST /uploads/preview`, add `POST /uploads/confirm`, refactor existing `POST /uploads` to be the single-site path |
| `backend/app/skills/data_ingestion/csv_parser.py` | Add `extract_zones(file: IO[bytes]) -> list[str]` function |

### Frontend Files

| File | Change |
|---|---|
| `frontend/components/UploadForm.tsx` | Convert to multi-step: Step 1 = file select, Step 2 = zone assignment |
| `frontend/components/ZoneAssignment.tsx` | New component — zone list + site dropdown + new site input + grouped summary |
| `frontend/lib/api.ts` | Add `previewUpload()` and `confirmUpload()` typed methods |
| `frontend/app/ops/page.tsx` or `frontend/app/page.tsx` | Ensure upload flow triggers new two-step UI |

### API Contracts

**POST /uploads/preview**

```text
Request: multipart/form-data with `file` (CSV)
Response: { zones: string[] }
```

**POST /uploads/confirm**

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

1. Upload single-zone CSV → behaves like today (one upload, one site)
2. Upload multi-zone CSV, assign zones to existing sites → creates batch with N child uploads
3. Upload multi-zone CSV, create new sites → creates batch, new sites, and N child uploads
4. Re-upload same CSV → dedup warning shown at preview
5. Both Hourly Averages and Min-by-Min formats work identically
6. Frontend build passes, TypeScript check passes
7. Backend tests pass
