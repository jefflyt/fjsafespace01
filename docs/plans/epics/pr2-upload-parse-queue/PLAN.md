# Epic Plan: PR2 - Upload & Parse Queue

> **STATUS**: ✅ **COMPLETED** (17 April 2026)
>
> All three sub-PRs have been fully implemented and
> verified in the codebase.
>
> - PR 2.1: Data Models & Supabase Storage Integration ✅
> - PR 2.2: FastAPI Upload Endpoint & CSV Parser ✅
> - PR 2.3: Frontend Upload UI & Queue Table ✅

## 1. Feature/Epic Summary

- **Objective**: Build the full-stack flow allowing
  analysts to upload IAQ CSV scans to Supabase Storage,
  parse them via FastAPI, and view their processing
  status in the dashboard.
- **User Impact**: Analysts can ingest raw sensor data
  efficiently while receiving immediate visual feedback
  on parsing success/failure or data validation issues.
- **Dependencies**: PR1 (Layout skeleton). Supabase
  Storage bucket credentials must be configured.
- **Assumptions**:
  - The database has an `uploads` or scan tracking table
    to monitor job state (`pending`, `processing`,
    `complete`, `failed`).
  - Parsing happens synchronously within the FastAPI
    request lifecycle (as per PSD-02), but we track state
    immediately before parsing starts and update it upon
    completion.

## 2. Complexity & Fit

- **Classification**: Multi-PR.
- **Rationale**: Building the frontend UI, Supabase
  Storage helpers, CSV parsing logic, and database
  tracking in one PR is too large and risky. Breaking it
  down ensures isolated testing of the backend parser
  and storage integration before building the UI state.
- **Estimated PRs**: 3

## 3. Full-Stack Impact

- **Frontend**: API fetch wrappers for file uploads. The
  `/analyst/upload` page with a file dropzone and a queue
  status table.
- **Backend**: Supabase Python client integration.
  FastAPI route `POST /api/uploads`. `parser.py` logic
  to validate and process CSV structure.
- **Data**: New SQLModel for Upload tracking (`id`,
  `filename`, `site_name`, `status`, `parse_outcome`,
  `uploaded_at`). Alembic migration.
- **Infra/Config**: Environment variables for Supabase
  Storage (Project URL, Service Role Key, Bucket Name).

## 4. PR Roadmap

### PR 2.1: Data Models & Supabase Storage Integration

- **Goal**: Establish the DB schema for tracking uploads
  and the backend utility for pushing files to Supabase
  Storage.
- **Scope (in)**: SQLModel `UploadJob`, Alembic migration
  script, `supabase_storage.py` helper in FastAPI.
- **Scope (out)**: CSV Parsing logic, actual upload
  endpoints, and the frontend.
- **Key Changes**: `backend/app/models/upload.py`,
  `backend/alembic/versions/`, `backend/app/config.py`,
  `backend/app/services/supabase_storage.py`.
- **Testing**: Unit tests for Supabase Storage upload
  helper using a mocked client.
- **Verification**: Run migrations (`alembic upgrade
  head`); verify the database table exists.
- **Rollback Plan**: Revert schema and downgrade Alembic.
- **Dependencies**: None.

### PR 2.2: FastAPI Upload Endpoint & CSV Parser

- **Goal**: Handle file receipt, save to Supabase
  Storage, parse the CSV, and update the upload status
  in the DB.
- **Scope (in)**: `POST /api/uploads` endpoint, CSV
  validation (ensuring essential columns exist), updating
  status to `complete` or `failed`.
- **Scope (out)**: Rule Evaluation logic (generating
  actual Findings/Alerts—that happens in PR3). This PR
  handles receiving the file and basic parse validation.
- **Key Changes**: `backend/app/routers/upload.py`,
  `backend/app/services/parser.py`.
- **Testing**: Unit test the CSV parser with corrupted
  datasets and missing columns. Test the FastAPI endpoint
  handling `multipart/form-data`.
- **Verification**: Call the FastAPI endpoint via a REST
  client (`curl`, Postman) with a sample CSV and verify
  response + DB state change.
- **Rollback Plan**: Delete the endpoints and parser
  logic.
- **Dependencies**: PR 2.1.

### PR 2.3: Frontend Upload UI & Queue Table

- **Goal**: Provide the Analyst interface to drop files
  and view processing queue.
- **Scope (in)**: File component in Next.js, Queue Table
  mapping the DB records, polling to fetch queue status.
- **Scope (out)**: Real-time WebSockets (we will use
  simple polling/refresh actions).
- **Key Changes**: `frontend/app/analyst/upload/page.tsx`,
  `frontend/components/ui/UploadForm.tsx`,
  `frontend/components/UploadQueueTable.tsx`, Frontend
  API client enhancements for `FormData`.
- **Testing**: Ensure UI handles file selection
  correctly, errors from the backend gracefully bubble
  up to UI toasts.
- **Verification**: Test the end-to-end flow: Select CSV
  -> Click Upload -> Watch Table show "Processing" ->
  Table shows "Complete".
- **Rollback Plan**: Revert frontend component changes.
- **Dependencies**: PR 2.2.

## 5. Milestones & Sequence

- **Milestone 1**: Backend Infrastructure Ready
  (PR 2.1 & PR 2.2). We can programmatically upload
  and parse CSVs via API.
- **Milestone 2**: E2E Upload Flow Complete (PR 2.3).
  Analysts can utilize the UI fully.

## 6. Risks, Trade-offs, and Open Questions

- **Major Risks**:
  - Large CSV parsing memory bounds if read
    synchronously in a single FastAPI worker.
  - Supabase Storage credentials might not be configured
    correctly locally, causing dev environment pain.
- **Trade-offs**:
  - Sticking to synchronous processing limits horizontal
    scalability but massively reduces infra complexity
    (no Celery/Redis). If a massive file times out, we
    may need a background queue later.
- **Open Questions**: Do we persist the raw readings
  row-by-row in Postgres, or just process them into
  findings and discard the bulk raw data? (Given the
  PSD, we likely process to findings and keep the
  original file in Supabase Storage).
