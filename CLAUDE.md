# FJDashboard — CLAUDE.md

## Project Overview

FJDashboard is the operational and reporting interface for the FJ SafeSpace
Indoor Air Quality (IAQ) platform. It processes rule-based findings into
traceable reports for operations and executive views.

### Core Architecture

- **Backend:** FastAPI (Python 3.12+), SQLModel (SQLAlchemy), Alembic for migrations.
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI, Recharts.
- **Database:** PostgreSQL (local via Homebrew `postgresql@17`, production via
  Supabase `jertvmbhgehajcrfifwl`).
- **PDF Engine:** WeasyPrint (native Python HTML-to-PDF).
- **File Storage:** Supabase Storage (bucket: `iaq-scans`) for raw CSV uploads
  only. PDFs are NOT stored — generated on-demand from immutable HTML snapshots
  in PostgreSQL.
- **Environment:** Single `.env` at project root for both backend and frontend.
- **Workflows:**
  - **Workflow A:** Standards governance (Reference Vault → Citation Units → Rulebook).
  - **Workflow B:** Scan-to-Report operations (Upload → Readings → Findings → Report).

---

## Project Status (as of 2026-04-28)

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
  - **PR8.2**: QA gate test fixtures & backend test coverage (55 passed, 47
    skipped — since deleted per D-R1-08)
  - **PR8.3**: Dashboard endpoint verification (5 endpoints, error handling, input validation)
  - **PR8.4**: 6 frontend components + 1 upload detail page
  - **PR8.5**: Utility scripts (run_qa_audit.py, preview_report.py — since deleted)
  - **PR8.6**: Frontend Vitest tests + production hardening (since deleted per D-R1-08)

### R1 Refactor: PR01-02 Complete, PR03 Next

- **Objective**: Transform dashboard from compliance/reporting model to
  human-friendly IAQ wellness dashboard with per-standard evaluation
  (SS 554, WELL v2, RESET Viral Index, SafeSpace)
- **Plans**: `docs/plans/epics/R1-Refactor/ROADMAP.md` + `pr01-auth-tenant.md`
  through `pr06-testing-polish.md`
- **Sequence**: PR-R1-01 (✅ Auth + Tenant) → PR-R1-02 (✅ Rulebook Reorg)
  → PR-R1-03 (Schema, next) → R1-04 (Backend API) → R1-05 (Frontend)
  → R1-06 (Testing)
- **Completed**:
  - PR-R1-01: user_tenant table, Supabase Auth JWT extraction, frontend login,
    default tenant seeded, sites assigned
  - PR-R1-02: 4 certification standards seeded, reference_source_id FK on
    rulebook_entry, fetch_rules_by_standard() service, all rules use
    rule_version="v2-refactor"

### Simplified Architecture (2 Views)

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
- `backend/app/services/db_rule_service.py` — Database rule service

### Existing Skills

- `backend/app/skills/data_ingestion/` — CSV parsing modules + Supabase Storage client
- `backend/app/skills/iaq_rule_governor/` — Rule evaluation engine

### Existing Frontend Components

- **UI** (Shadcn): button, input, card, dialog, label, select, table, badge, dropdown-menu, textarea, checkbox
- **Feature**: UploadForm, UploadQueueTable, WellnessIndexCard, CrossSiteComparisonTable, DailySummaryCard, TrendChart, NotificationBell
- **Findings**: MetricChart, TimeSeriesChart, MetricConfig, types
- **Layout**: Navbar, Sidebar

### Test Coverage

- **Backend**: `backend/tests/` exists with `__init__.py` only. Old test suite
  deleted per D-R1-08. New tests will be built fresh in PR-R1-06.
- **Frontend**: `frontend/tests/` deleted. Vitest config present. New tests
  will be built fresh in PR-R1-06.

### Existing Scripts & Sample Data

- `scripts/seed_rulebook_v1.py` — Seeds 4 standards: SS 554, WELL v2,
  RESET Viral Index, SafeSpace (rule_version="v2-refactor")
- `scripts/seed_default_tenant.py` — Seeds default tenant, assigns sites
- `assets/sample_uploads/npe_sample.csv` — New Park Estate sample (3 zones, 24 rows, clean PASS)
- `assets/sample_uploads/cag_sample.csv` — Changi Airport Group sample (3 zones, 30 rows, data gaps + critical CO2)

---

## Technical Commands

### Backend (Python)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # Apply migrations
fastapi dev app/main.py       # Start dev server on port 8000
```

### Frontend (Next.js)

```bash
cd frontend
pnpm install
pnpm dev                      # Start dev server on port 3000
```

### Infrastructure

```bash
brew services start postgresql@17  # Start local PostgreSQL on port 5432
brew services stop postgresql@17   # Stop local PostgreSQL
python scripts/seed_rulebook.py  # Seed rulebook data
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
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Storage service role key |
| `SUPABASE_STORAGE_BUCKET` | Yes | Storage bucket name (default: `iaq-scans`) |
| `SUPABASE_JWT_SECRET` | R1+ | Supabase JWT secret (PR-R1-01 JWT extraction) |
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI backend base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | R1+ | Supabase URL for frontend auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | R1+ | Supabase anon key for frontend auth |
| `CLERK_SECRET_KEY` | Deprecated | Legacy — to be removed |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Deprecated | Legacy — to be removed |

### Setup Guides

- **Supabase Storage**: See `docs/setup/SUPABASE_SETUP.md`
- **Schema Reference**: See `docs/SCHEMA_REFERENCE.md` for all tables, columns, and data flow

---

## Development Conventions

### Traceability & Governance

- **Mandatory Metadata:** Every finding **must** include a `rule_version`
  and `citation_id`.
- **Read-Only Rulebook:** The dashboard (Workflow B) must **never** mutate
  Rulebook tables. Access is `SELECT` only at the DB level. Rule changes
  must use `ADMIN_DATABASE_URL`.
- **No Manual Overrides:** Threshold overrides in production are strictly prohibited.
- **Source Currency:** Only `CURRENT_VERIFIED` sources can drive certification-impact rules. Others are marked "Advisory Only".

### QA Gates (Legacy — PR1-8 compliance model)

> **Note**: QA gates apply to existing PR1-8 code only. The R1 refactor pivots
> from compliance/reporting to human-friendly wellness evaluation. Per-standard
> evaluation and interpretation layers replace the compliance gate system.
> New tests for R1 will be built in PR-R1-06.

Historical QA gates (QA-G1 to QA-G9) from the compliance model:

- Citations must link to `rule_version` and `citation_unit_ids`.
- Findings from non-`CURRENT_VERIFIED` sources must be labeled "Advisory Only".
- `reviewerName` in `Report` must match authorized approver (Jay Choy).
- If any gate fails, do NOT generate or export the PDF.

### Design Principles

- **Evidence Before Aesthetics:** Accuracy and traceability take precedence
  over visual flair.
- **Synchronous Pipeline:** All processing (parsing and PDF generation) is
  currently synchronous.
- **Surgical Updates:** When modifying schema or API contracts, ensure the
  TDD version is bumped and recorded in the Decision Log.

---

## Key Files & Directories

- `docs/`: Authority for PRD, PSD, and TDD specifications.
- `docs/setup/`: Setup guides (Supabase, etc.)
- `docs/plans/MASTER_PLAN.md`: Original master plan with 4 phases, PR breakdown.
- `docs/plans/MASTER_PLAN-Refactor.md`: Refactor master plan with R1-R4 phases.
- `docs/plans/epics/R1-Refactor/`: R1 epic plans (ROADMAP.md + pr01 through pr06).
- `docs/PSD-Refactor.md`: Product Specification for refactor.
- `docs/TDD-Refactor.md`: Technical Design Document for refactor.
- `.env`: Single environment file at project root for both backend and frontend.
- `.env.example`: Template with placeholders.
- `backend/app/core/config.py`: Settings — loads `.env` from project root via pathlib.
- `backend/app/models/`: SQLModel definitions split by workflow (A, B) +
  supporting.
- `backend/app/services/`: Core logic for CSV parsing, rule evaluation,
  aggregation.
- `backend/app/api/routers/`: 5 route files — dashboard, notifications, reports, rulebook, uploads.
- `backend/app/api/dependencies.py`: Supabase JWT extraction, tenant scoping
  (replaced stub in PR-R1-01).
- `backend/app/templates/`: WeasyPrint HTML/CSS report templates (Jinja2 syntax).
- `backend/migrations/versions/`: Alembic migrations (001 through 015).
  - 001: Core tables (site, upload, reading, finding, report, reference_source,
    citation_unit, rulebook_entry)
  - 002: Report QA fields (reviewer_name, qa_checks, certification_outcome)
  - 003: Indexes for cross-site aggregation queries
  - 004: Upload report_type column (auto-detected ASSESSMENT vs
    INTERVENTION_IMPACT)
  - 005: Replace pdf_url with report_snapshot (immutable JSON for on-demand
    PDF generation)
  - 006: Reading zone_name column
  - 007: Tenant and customer info columns
  - 008-011: Pending PR-R1-03 (site context, scan type, metric preferences,
    site standards)
  - 012-013: Pending R2 (device connection, alert log)
  - 014: user_tenant table (PR-R1-01)
  - 015: reference_source_id FK on rulebook_entry (PR-R1-02)
- `backend/tests/`: Empty — new tests to be built in PR-R1-06.
- `frontend/components/`: Feature components (see list above).
- `frontend/lib/api.ts`: Centralized fetch client for backend communication.
- `scripts/`: Utility scripts (seed_rulebook, seed_rulebook_v1).
- `assets/sample_uploads/`: Sample CSV datasets for QA and testing.

---

## Deferred to Phase 2/3

| Item | Reason | Phase |
| ------ | ------ | ----- |
| Playwright E2E tests | Better suited for CI/CD | Phase 2 |
| CI/CD pipeline | Infrastructure work, separate PR | Phase 2/3 |
| Clerk auth integration | Replaced by Supabase Auth for R1 | Deprecated |

---

**Completed (previously deferred):**

- ~~PDF templates~~ — Implemented in PR5 + PR8.6. Immutable snapshot
  architecture in place (migration 005).
- ~~Tenant isolation~~ — user_tenant table + JWT extraction done (PR-R1-01).
- ~~Rulebook reorganization~~ — 4 standards seeded with v2-refactor (PR-R1-02).

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

## Workflow B: Scan-to-Report (Legacy — compliance model)

> **Note**: PDF report generation is deferred to R3. The R1 refactor replaces
> the compliance/reporting view with a human-friendly IAQ wellness dashboard.
> Existing PDF templates and QA gate logic remain for historical PR1-8 code
> but are not the primary UX for R1.

The compliance model generated PDF reports via WeasyPrint from immutable HTML
snapshots. Key conventions from the original model:

- Templates use `Jinja2` syntax in `backend/app/templates/`.
- Templates branch for `ASSESSMENT` and `INTERVENTION_IMPACT` report types.
- Executive brief displayed status: `HEALTHY_WORKPLACE_CERTIFIED`, etc.
- Preview script (`scripts/preview_report.py`) was deleted — reports are now generated via API endpoints.

### R1 Replacement

The R1 refactor introduces:

- **Per-standard evaluation**: Independent pass/fail per SS 554, WELL v2,
  RESET Viral Index, SafeSpace
- **Human-readable interpretations**: Threshold bands mapped to plain-language insights
- **Metric preferences**: Per-site customizable visible metrics and alert thresholds
- **Wellness scoring**: Weighted scores per standard, not single compliance outcome
