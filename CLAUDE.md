# FJDashboard — CLAUDE.md

## Project Overview

FJDashboard is the operational and reporting interface for the FJ SafeSpace Indoor Air Quality (IAQ) platform. It processes rule-based findings into traceable reports for operations and executive views.

### Core Architecture

- **Backend:** FastAPI (Python 3.12+), SQLModel (SQLAlchemy), Alembic for migrations.
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI, Recharts.
- **Database:** PostgreSQL (local via Docker Compose, production via Render/Supabase).
- **PDF Engine:** WeasyPrint (native Python HTML-to-PDF).
- **File Storage:** Supabase Storage (bucket: `iaq-scans`) for raw CSV uploads only. PDFs are NOT stored — they are generated on-demand from immutable HTML snapshots stored in PostgreSQL.
- **Database:** PostgreSQL (Supabase production: `jertvmbhgehajcrfifwl`, local via Docker Compose).
- **Environment:** Single `.env` at project root for both backend and frontend.
- **Workflows:**
  - **Workflow A:** Standards governance (Reference Vault → Citation Units → Rulebook).
  - **Workflow B:** Scan-to-Report operations (Upload → Readings → Findings → Report).

---

## Project Status (as of 2026-04-19)

### PR1-8: Complete — UAT Ready

- **PR1**: Layout skeleton & Shadcn UI components
- **PR2**: Upload ingest, CSV parsing, Supabase Storage
- **PR3**: Findings panel with rule_version + citation_id traceability
- **PR4**: Report draft builder & QA checklist (QA-G1 to QA-G8)
- **PR5**: WeasyPrint PDF generation pipeline (Assessment + Intervention Impact)
- **PR6**: Executive dashboard, aggregation service, cross-site comparison, Wellness Index
- **PR7**: Workflow A — Rulebook seed script (WHO AQG 2021 + SS554), read-only API, Alembic migration fix
- **PR8**: UAT Readiness & Production Hardening — **ALL 6 SUB-PRs COMPLETE**
  - **PR8.1**: Infrastructure bootstrap (Alembic migrations persisted, docker-compose.yml, `.env.example`)
  - **PR8.2**: QA gate test fixtures & backend test coverage (55 passed, 47 skipped)
  - **PR8.3**: Dashboard endpoint verification (5 endpoints, error handling, input validation)
  - **PR8.4**: 6 frontend components + 1 upload detail page
  - **PR8.5**: Utility scripts (run_qa_audit.py, preview_report.py) + sample datasets
  - **PR8.6**: Frontend Vitest tests + production hardening

### Simplified Architecture (2 Views)

The project has been simplified from 3 phases with multiple pages down to 2 views:

| View | Route | Purpose |
| --- | --- | --- |
| **Operations** | `/ops` | Upload CSV, review findings, generate reports (3 tabs) |
| **Executive** | `/executive` | Results summary, top risks/actions, historical scan selector |

### Existing Backend Routes

- **uploads**: `POST /api/uploads`, `GET /api/uploads/{id}`, `GET /api/uploads/{id}/findings`
- **reports**: `POST /api/reports`, `GET /api/reports`, `GET /api/reports/{id}`, `PATCH /api/reports/{id}/qa-checklist`, `POST /api/reports/{id}/approve`, `GET /api/reports/{id}/export`, `GET /api/reports/{id}/pdf`
- **dashboard**: `GET /api/dashboard/sites`, `GET /api/dashboard/sites/{id}/zones`, `GET /api/dashboard/comparison`, `GET /api/dashboard/summary`, `GET /api/dashboard/executive`
- **rulebook**: `GET /api/rulebook/rules`, `GET /api/rulebook/rules/{id}`, `GET /api/rulebook/sources`
- **notifications**: `GET /api/notifications`, `PATCH /api/notifications/{id}/read`

### Existing Frontend Pages

- `/ops/` — Operations view (Upload, Findings, Reports tabs)
- `/executive/` — Executive dashboard

### Existing Backend Services

- `backend/app/services/aggregation.py` — Wellness Index calculation, cross-site aggregation
- `backend/app/services/pdf_orchestrator.py` — WeasyPrint HTML-to-PDF generation
- `backend/app/services/qa_gates.py` — QA-G1 through QA-G8 evaluation
- `backend/app/skills/data_ingestion/` — CSV parsing modules + Supabase Storage client
- `backend/app/skills/iaq_rule_governor/` — Rule evaluation engine
- `backend/app/skills/report-template-stylist/` — Template rendering
- `backend/app/skills/qa-compliance-gatekeeper/` — QA compliance

### Existing Frontend Components

- **UI**: button, input, card, dialog, label, select, table, badge, dropdown-menu, textarea
- **Feature**: CitationBadge, CitationDrawer, QAChecklist, ReportTypeBadge, UploadForm
- **Dashboard**: WellnessIndexCard, CrossSiteComparisonTable, TrendChart, DailySummaryCard, NotificationBell
- **Layout**: Navbar, Sidebar

### Existing Test Coverage

- **Backend**: 55 passed, 47 skipped, 0 failed (pytest)
  - 86 lines of conftest fixtures (db_engine, db_session, client)
  - `test_report_pipeline.py` — 14 test classes (QA-G1 through QA-G9, approval, rulebook, comparison, PDF)
  - `test_dashboard_endpoints.py` — 11 test classes (5 endpoints, populated/empty states)
  - 4 unit tests: aggregation, csv_parser, qa_gates, rule_engine
  - 1 integration test: upload_pipeline
- **Frontend**: Vitest + jsdom + testing-library
  - `tests/components.test.tsx` — WellnessIndexCard, CitationBadge, CrossSiteComparisonTable, DailySummaryCard, TrendChart
  - `tests/wellness-index-card.test.tsx` — 6 dedicated tests

### Existing Scripts & Sample Data

- `scripts/seed_rulebook.py` — Populates WHO AQG 2021 + SS554 rulebook entries
- `scripts/run_qa_audit.py` — Runs all 8 QA gates against an upload_id
- `scripts/preview_report.py` — Renders report HTML template to PDF for visual inspection
- `assets/sample_uploads/npe_sample.csv` — New Park Estate sample (3 zones, 24 rows, clean PASS)
- `assets/sample_uploads/cag_sample.csv` — Changi Airport Group sample (3 zones, 30 rows, data gaps + critical CO2)
- `assets/sample_finding_data.json` — Sample finding JSON for template preview

---

## Technical Commands

### Backend (Python)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # Apply migrations
fastapi dev app/main.py       # Start dev server on port 8000
pytest tests/unit             # Run unit tests
pytest tests/integration      # Run integration tests
```

### Frontend (Next.js)

```bash
cd frontend
pnpm install
pnpm dev                      # Start dev server on port 3000
pnpm test                     # Run Vitest unit tests
```

### Infrastructure

```bash
docker compose up -d          # Start local PostgreSQL on port 5432
python scripts/seed_rulebook_v1.py  # Seed rulebook data
```

### QA & Reporting

```bash
python scripts/run_qa_audit.py --upload-id <UPLOAD_UUID>
python scripts/preview_report.py --template assessment.html --data assets/sample_finding_data.json --output preview.pdf
```

---

## Environment

### Single `.env` at Project Root

All variables documented in `.env.example`. Config loads via `backend/app/core/config.py` using pathlib resolution.

| Variable | Required | Description |
| ------ | ------ | ------ |
| `DATABASE_URL` | Yes | PostgreSQL connection string (app role — SELECT-only on Rulebook tables) |
| `ADMIN_DATABASE_URL` | Yes | Full-access DB role for Workflow A admin console only |
| `APPROVER_EMAIL` | Yes | Jay Choy's email — enforced by QA-G8 |
| `RESEND_API_KEY` | Yes | Email dispatch (Phase 2+) |
| `SUPABASE_URL` | For upload flow | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For upload flow | Supabase Storage service role key |
| `SUPABASE_STORAGE_BUCKET` | For upload flow | Storage bucket name (default: `iaq-scans`) |
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI backend base URL |
| `CLERK_SECRET_KEY` | Phase 3 only | Clerk secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Phase 3 only | Clerk publishable key |

### Setup Guides

- **Supabase Storage**: See `docs/setup/SUPABASE_SETUP.md`
- **Schema Reference**: See `docs/SCHEMA_REFERENCE.md` for all 11 tables, columns, and data flow

---

## Development Conventions

### Traceability & Governance

- **Mandatory Metadata:** Every finding **must** include a `rule_version` and `citation_id`.
- **Read-Only Rulebook:** The dashboard (Workflow B) must **never** mutate Rulebook tables. Access is limited to `SELECT` only at the DB level. Rule changes must use `ADMIN_DATABASE_URL`.
- **No Manual Overrides:** Threshold overrides in production are strictly prohibited.
- **Source Currency:** Only `CURRENT_VERIFIED` sources can drive certification-impact rules. Others are marked "Advisory Only".

### QA Gates

All 9 QA gate tests (QA-G1 to QA-G9) must pass before merging to `main`. Key gates include:

- Citations must link to `rule_version` and `citation_unit_ids`.
- Findings from non-`CURRENT_VERIFIED` sources must be labeled "Advisory Only".
- `reviewerName` in `Report` must match authorized approver (Jay Choy).
- If any gate fails, do NOT generate or export the PDF.

### Design Principles

- **Evidence Before Aesthetics:** Accuracy and traceability take precedence over visual flair.
- **Synchronous Pipeline:** All processing (parsing and PDF generation) is currently synchronous.
- **Surgical Updates:** When modifying schema or API contracts, ensure the TDD version is bumped and recorded in the Decision Log.

---

## Key Files & Directories

- `docs/`: Authority for PRD, PSD, and TDD specifications.
- `docs/setup/`: Setup guides (Supabase, etc.)
- `docs/plans/MASTER_PLAN.md`: Master plan with 4 phases, PR breakdown, risks.
- `docs/plans/epics/`: Individual PR epic plans (pr1 through pr8).
- `docs/FJDashboard_TDD.md`: Technical Design Document.
- `.env`: Single environment file at project root for both backend and frontend.
- `.env.example`: Template with placeholders.
- `backend/app/core/config.py`: Settings — loads `.env` from project root via pathlib.
- `backend/app/models/`: SQLModel definitions split by workflow (A and B).
- `backend/app/services/`: Core logic for CSV parsing, rule evaluation, and PDF orchestration.
- `backend/app/api/routers/`: 5 route files — dashboard, notifications, reports, rulebook, uploads.
- `backend/app/templates/`: WeasyPrint HTML/CSS report templates (Jinja2 syntax).
- `backend/migrations/versions/`: Alembic migrations (001_initial_tables through 005_report_snapshot).
  - 001: Core tables (site, upload, reading, finding, report)
  - 002: Report QA fields (reviewer_name, qa_checks, certification_outcome)
  - 003: Indexes for cross-site aggregation queries
  - 004: Upload report_type column (auto-detected ASSESSMENT vs INTERVENTION_IMPACT)
  - 005: Replace pdf_url with report_snapshot (immutable JSON for on-demand PDF generation)
- `backend/tests/`: Backend test suite — conftest fixtures, report pipeline, dashboard endpoints, unit tests.
- `frontend/tests/`: Frontend Vitest tests with jsdom environment.
- `frontend/app/dashboard/`: Dashboard pages (analyst, executive).
- `frontend/components/`: Feature components (WellnessIndexCard, CrossSiteComparisonTable, etc.).
- `frontend/lib/api.ts`: Centralized fetch client for backend communication.
- `scripts/`: Utility scripts (seed_rulebook_v1, run_qa_audit, preview_report).
- `assets/sample_uploads/`: Sample CSV datasets for QA and testing.
- `docker-compose.yml`: PostgreSQL 16 local dev database.

---

## Deferred to Phase 2/3

| Item | Reason | Phase |
| ------ | ------ | ----- |
| Playwright E2E tests | Requires browser installation, better suited for CI/CD | Phase 2 |
| CI/CD pipeline | Infrastructure work, separate PR | Phase 2/3 |
| Tenant isolation (QA-G9) | Phase 3 security requirement | Phase 3 |
| Clerk auth integration | Phase 3 customer portal | Phase 3 |

---

**Completed (previously deferred):**

- ~~PDF templates~~ — Implemented in PR5 + PR8.6. Immutable snapshot architecture in place (migration 005).

---

## Workflow A: IAQ Rule Governor

Governs the Reference Vault → Citation Units → Rulebook pipeline.

### Ingesting a New Standard

1. Register `ReferenceSource` with appropriate `source_currency_status`.
2. Create `CitationUnit` records for specific clauses, ensuring verbatim `exact_excerpt`.
3. Draft `RulebookEntry` records linked to new citations.

### Updating Thresholds

1. Locate existing `RulebookEntry`.
2. Mark old entry as `superseded` and set `effective_to`.
3. Create new `RulebookEntry` with updated values, increment `rule_version`.

### Guardrails

- No rule can exist without at least one linked `CitationUnit`.
- Models: `backend/app/models/workflow_a.py`

---

## Workflow B: Report Template Stylist

Governs WeasyPrint HTML/CSS templates for PDF reports.

### Creating/Updating Templates

- Use `Jinja2` syntax in `backend/app/templates/`.
- Define `@page` rules in CSS for A4 margins and header/footer.
- Template must branch for `ASSESSMENT` and `INTERVENTION_IMPACT` report types.

### Executive Brief

- Display status: `HEALTHY_WORKPLACE_CERTIFIED`, `HEALTHY_SPACE_VERIFIED`, etc.
- Highlight top 3 findings by `alert_priority`.
- Include reviewer name and date (QA-G8 requirement).

### Previewing Templates

```bash
python scripts/preview_report.py --template assessment.html --data assets/sample_finding_data.json --output preview.pdf
```

---

## QA Compliance Audit

```bash
python scripts/run_qa_audit.py --upload-id <UPLOAD_UUID>
```
