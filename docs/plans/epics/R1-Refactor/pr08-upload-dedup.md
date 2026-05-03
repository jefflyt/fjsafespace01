# PR Plan: PR-R1-08 — CSV Upload Deduplication — ✅ COMPLETE

## 0) Pre-Flight Roadmap Check

- **Dependencies**: ✅ PR-R1-07 merged (tenant_id flow in place)
- **Scope boundaries**: ✅ All scope (in) delivered, no scope (out) leakage
- **Risks**: ✅ NULL content_hash handled gracefully — no false positives
- **Status**: ✅ Implemented and verified

**Post-Completion Check**:

- ✅ All scope (in) items are delivered
- ✅ No regression in existing upload flow (5/5 tests pass, build succeeds)

**Bug Fixes (2026-05-03)**:

- ✅ Fixed `is_duplicate` in `list_uploads` — was `content_hash is not None` (flagged ALL uploads), now always `False` (duplicates return existing record, not new)
- ✅ Removed duplicate popup from `/executive` page — belongs only in UploadForm after upload
- ✅ Added test data cleanup to prevent DB pollution from integration tests

## 1) Feature Summary

- **Goal**: Detect when the same CSV file has been uploaded before and suggest loading existing findings instead of creating a noisy duplicate entry
- **User Story**: As FJ staff, I accidentally upload the same CSV twice during an adhoc session. Instead of creating a duplicate set of findings that clutters the dashboard, I'm shown a dialog: "This CSV was previously uploaded for [Client] on [date]. View existing findings?" I can choose to view them or upload anyway if needed.
- **User Impact**: Prevents dashboard noise from accidental re-uploads. Users get a clear choice — view existing or force a new upload.
- **Acceptance Criteria**:
  1. SHA-256 content hash computed and stored on every new upload
  2. Same CSV + same tenant → detected as duplicate, dialog shown
  3. `force=true` parameter → bypasses dedup, creates new entry
  4. Same CSV + different tenant → NOT a duplicate (different assessment)
  5. FAILED/PENDING uploads with same content → allows retry
  6. Frontend dialog shows upload date + filename, offers View / Upload Anyway / Cancel
  7. No false positives for legacy uploads (NULL content_hash)
- **Non-goals**: Continuous monitoring dedup (API-based, handled differently), fuzzy/similar CSV detection (only exact byte match), global dedup across tenants

## 2) Approach Overview

### Why Tenant-Scoped (Not Site-Scoped)

Continuous monitoring uses uHoo API pulls — no manual uploads. The only manual upload path is the adhoc flow, which auto-creates a new site per upload. Site-scoped dedup would miss the common case where the same tenant uploads the same CSV twice, each creating a different auto-site.

Tenant-scoped dedup catches this: same tenant + same content hash = duplicate, regardless of which auto-site was created.

### Architecture

```text
POST /api/uploads
  1. Read file bytes
  2. Compute SHA-256 hash
  3. If tenant_id exists and force=false:
     → Query: SELECT * FROM upload
              WHERE content_hash = :hash
                AND site_id IN (SELECT id FROM site WHERE tenant_id = :tenant_id)
                AND parse_status = 'COMPLETE'
  4. If match found → return existing upload with is_duplicate=true
  5. If no match → proceed with normal upload flow, store content_hash
```

### Frontend Flow

```text
UploadForm submits CSV
  → Response has is_duplicate: true
    → Show dialog: "Duplicate Upload Detected"
      → "View Existing Findings" → navigates to findings
      → "Upload Anyway" → resubmit with force=true
      → "Cancel" → dismiss
```

## 3) Implementation Details

### Task 1: Migration 017 — Add `content_hash` column — ✅ DONE

**File:** `backend/migrations/versions/017_upload_content_hash.py` (created)

### Task 2: Upload model — add `content_hash` field — ✅ DONE

**File:** `backend/app/models/workflow_b.py` — field added

### Task 3: Upload endpoint — dedup logic — ✅ DONE

**File:** `backend/app/api/routers/uploads.py` — all 3 changes applied + `force` parameter

### Task 4: Backend tests — ✅ DONE (5/5 pass)

**File:** `backend/tests/test_upload_dedup.py` (created)

### Task 5: Frontend — duplicate dialog — ✅ DONE

**File:** `frontend/components/UploadForm.tsx` — all changes applied

## 4) File Inventory

| Action | File |
|---|---|
| Create | `backend/migrations/versions/017_upload_content_hash.py` |
| Modify | `backend/app/models/workflow_b.py` |
| Modify | `backend/app/api/routers/uploads.py` |
| Create | `backend/tests/test_upload_dedup.py` |
| Modify | `frontend/components/UploadForm.tsx` |

## 5) Edge Cases

| Edge Case | Behavior | Rationale |
|---|---|---|
| Same CSV + different tenant | NOT duplicate | Different customer, different assessment |
| Same CSV + same tenant, previous FAILED | NOT duplicate | Allow retry after failure |
| Same CSV + same tenant, previous PENDING | NOT duplicate | Previous may be stuck; allow parallel |
| `force=true` | New upload created | User explicitly overrides |
| CSV with different line endings | Different hashes | Acceptable — technically different bytes |
| Legacy uploads (NULL content_hash) | No false match | NULL != hash; excluded from query |
| File renamed, content identical | Detected as duplicate | Hash is content-based, not filename-based |
