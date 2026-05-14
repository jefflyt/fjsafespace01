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
- **File Storage:** Supabase Storage (bucket: `iaq-scans`) for raw CSV uploads
  only.
- **Environment:** Single `.env` at project root for both backend and frontend.
- **Workflows:**
  - **Workflow A:** Standards governance (Reference Vault → Citation Units → Rulebook).
  - **Workflow B:** Scan-to-Dashboard operations (Upload → Readings → Findings → Per-standard evaluation).

---

## Current Status

PR1-8 complete. R1 refactor in progress — PR-R1-01 through PR-R1-10 complete, PR-R1-11 next.
See `docs/plans/epics/R1-Refactor/ROADMAP.md` for the full plan and status.

All migrations (001–021) merged and applied to Supabase.

### Routes

| View | Route | Purpose |
| --- | --- | --- |
| **Scan Listing** | `/` | Site listing with latest scan results (home page) |
| **Site Detail** | `/sites/{siteId}` | All scans, standard selector, zone details, scan history |
| **Operations** | `/ops` | Upload CSV, review findings — redirects to `/` |
| **Executive** | `/executive` | Results summary, top risks/actions, historical scan selector |
| **Admin** | `/admin/customers` | Customer management (FJ staff) |
| **Login** | `/login` | Supabase Auth login |

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
```

---

## Environment

### Single `.env` at Project Root

All variables documented in `.env.example`. Config loads via `backend/app/core/config.py` using pathlib resolution.

| Variable | Required | Description |
| ------ | ------ | ------ |
| `DATABASE_URL` | Yes | PostgreSQL connection string (app role — SELECT-only on Rulebook tables) |
| `ADMIN_DATABASE_URL` | Yes | Full-access DB role for Workflow A admin console only |
| `APPROVER_EMAIL` | Yes | Jay Choy's email |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Storage service role key |
| `SUPABASE_STORAGE_BUCKET` | Yes | Storage bucket name (default: `iaq-scans`) |
| `SUPABASE_JWT_SECRET` | Yes | Supabase JWT secret (PR-R1-01 JWT extraction) |
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI backend base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL for frontend auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key for frontend auth |

### Setup Guides

- **Supabase Storage**: `docs/setup/SUPABASE_SETUP.md`
- **Schema Reference**: `docs/SCHEMA_REFERENCE.md`

---

## Development Conventions

### Traceability & Governance

- **Mandatory Metadata:** Every finding **must** include a `rule_version`
  and `citation_id`.
- **Read-Only Rulebook:** The dashboard (Workflow B) must **never** mutate
  Rulebook tables. Access is `SELECT` only at the DB level. Rule changes
  must use `ADMIN_DATABASE_URL`.
- **Source Currency:** Only `CURRENT_VERIFIED` sources can drive certification-impact rules. Others are marked "Advisory Only".

### Design Principles

- **Evidence Before Aesthetics:** Accuracy and traceability take precedence
  over visual flair.
- **Synchronous Pipeline:** All processing (parsing, evaluation) is synchronous.
- **Surgical Updates:** When modifying schema or API contracts, ensure the
  TDD version is bumped and recorded in the Decision Log.

### Frontend Libraries

- `frontend/lib/api.ts` — Fetch client for FastAPI backend
- `frontend/lib/constants.ts` — Global constants (OUTCOME_CONFIG, BAND_TAILWIND, getScoreColor, BAND_PRIORITY, BAND_TO_OUTCOME, bandToOutcome). **All new components should import from here instead of duplicating.**
- `frontend/lib/utils.ts` — `cn()`, `formatDate`, re-exports from constants.ts
- `frontend/lib/supabase.ts` — Supabase auth client

### Scripts & Sample Data

- `scripts/seed_rulebook_v1.py` — Seeds 4 standards (rule_version="v2-refactor")
- `scripts/seed_default_tenant.py` — Seeds default tenant, assigns sites
- `scripts/cleanup_test_data.py` — Removes all test data except NPE tenant
- `assets/sample_uploads/` — Sample CSV datasets

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

## Workflow B: Per-Standard Evaluation

The R1 dashboard replaces the compliance/reporting model with:

- **Per-standard evaluation**: Independent pass/fail per SS 554, WELL v2,
  RESET Viral Index, SafeSpace
- **Human-readable interpretations**: Threshold bands mapped to plain-language insights
- **Metric preferences**: Per-site customizable visible metrics and alert thresholds
- **Wellness scoring**: Weighted scores per standard

Rule evaluation engine: `backend/app/skills/iaq_rule_governor/`
CSV parsing: `backend/app/skills/data_ingestion/`
Aggregation service: `backend/app/services/aggregation.py`
DB rule service: `backend/app/services/db_rule_service.py`

---

## Deferred to Phase 2/3

| Item | Reason | Phase |
| ------ | ------ | ----- |
| Playwright E2E tests | Better suited for CI/CD | Phase 2 |
| CI/CD pipeline | Infrastructure work, separate PR | Phase 2/3 |

---

## Key Reference Docs

- `docs/plans/epics/R1-Refactor/ROADMAP.md` — Current R1 roadmap
- `docs/plans/MASTER_PLAN.md` — Original master plan
- `docs/plans/MASTER_PLAN-Refactor.md` — Refactor master plan (R1-R4)
- `docs/PSD-Refactor.md` — Product Specification
- `docs/TDD-Refactor.md` — Technical Design Document
