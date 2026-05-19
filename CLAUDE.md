# FJDashboard — CLAUDE.md

## Project Overview

FJDashboard is the operational and reporting interface for the FJ SafeSpace Indoor Air Quality (IAQ) platform. It processes rule-based findings into traceable reports for operations and executive views.

### Tech Stack

- **Backend:** FastAPI (Python 3.12+), SQLModel (SQLAlchemy), Alembic for migrations
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI, Recharts
- **Database:** PostgreSQL via Supabase (`jertvmbhgehajcrfifwl`)
- **File Storage:** Supabase Storage (bucket: `iaq-scans`) for raw CSV uploads only
- **Environment:** Single `.env` at project root for both backend and frontend
- **Workflows:**
  - **Workflow A:** Standards governance (Reference Vault → Citation Units → Rulebook)
  - **Workflow B:** Scan-to-Dashboard operations (Upload → Readings → Findings → Per-standard evaluation)

---

## Current Status

All R1 PRs (PR-R1-01 through PR-R1-12) are complete. PR-R1-06 (Testing & Polish) is the remaining item. See `docs/plans/epics/R1-Refactor/ROADMAP.md` for full details.

Migrations 001–021 are merged and applied to Supabase.

### Routes

| View | Route | Purpose |
| --- | --- | --- |
| **Scan Listing** | `/` | Site listing with latest scan results (home page) |
| **Site Detail** | `/sites/{siteId}` | All scans, standard selector, zone details, scan history |
| **Scan Data View** | `/scan-data/{siteId}` | Raw IAQ metrics as time-series, anomaly summary, trend comparison |
| **Scan Compare** | `/scan-data/{siteId}/compare` | Side-by-side scan comparison with metric charts |
| **Operations** | `/ops` | Upload CSV, review findings — redirects to `/` |
| **Executive** | `/executive` | Results summary, top risks/actions, historical scan selector |
| **Admin** | `/admin/customers` | Customer management (FJ staff) |
| **Login** | `/login` | Supabase Auth login |

---

## Technical Commands

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # Apply migrations
fastapi dev app/main.py       # Start dev server on port 8000
```

### Frontend

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

Single `.env` at project root. Config loads via `backend/app/core/config.py` using pathlib resolution. Full list in `.env.example`.

Key variables:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (app role — SELECT-only on Rulebook tables) |
| `ADMIN_DATABASE_URL` | Full-access DB role for Workflow A admin console only |
| `APPROVER_EMAIL` | Jay Choy's email |
| `SUPABASE_*` | Supabase URL, service role key, storage bucket, JWT secret |
| `NEXT_PUBLIC_API_URL` | FastAPI backend base URL |
| `NEXT_PUBLIC_SUPABASE_*` | Supabase URL + anon key for frontend auth client |

Setup guides: `docs/setup/SUPABASE_SETUP.md`, `docs/SCHEMA_REFERENCE.md`

---

## Development Conventions

### Traceability & Governance

- Every finding **must** include `rule_version` and `citation_id`
- Dashboard (Workflow B) must **never** mutate Rulebook tables — SELECT-only at DB level. Rule changes must use `ADMIN_DATABASE_URL`
- Only `CURRENT_VERIFIED` sources drive certification-impact rules; others are marked "Advisory Only"

### Design Principles

- Evidence before aesthetics — accuracy and traceability over visual flair
- Synchronous pipeline — all parsing and evaluation is synchronous
- Surgical updates — bump TDD version on API/schema changes

### Frontend Libraries

| File | Purpose |
| --- | --- |
| `frontend/lib/api.ts` | Fetch client for FastAPI backend |
| `frontend/lib/constants.ts` | OUTCOME_CONFIG, BAND_TAILWIND, getScoreColor, BAND_PRIORITY, BAND_TO_OUTCOME, bandToOutcome. Import from here instead of duplicating |
| `frontend/lib/utils.ts` | `cn()`, `formatDate`, re-exports from constants.ts |
| `frontend/lib/supabase.ts` | Supabase auth client |

### Scripts & Sample Data

- `scripts/seed_rulebook_v1.py` — Seeds 4 standards (rule_version="v2-refactor")
- `scripts/seed_default_tenant.py` — Seeds default tenant, assigns sites
- `scripts/cleanup_test_data.py` — Removes all test data except NPE tenant
- `assets/sample_uploads/` — Sample CSV datasets

---

## Workflow A: IAQ Rule Governor

Governs the Reference Vault → Citation Units → Rulebook pipeline. Models: `backend/app/models/workflow_a.py`

### Ingesting a New Standard

1. Register `ReferenceSource` with appropriate `source_currency_status`
2. Create `CitationUnit` records for specific clauses (verbatim `exact_excerpt`)
3. Draft `RulebookEntry` records linked to new citations

### Updating Thresholds

1. Locate existing `RulebookEntry`
2. Mark old entry as `superseded`, set `effective_to`
3. Create new `RulebookEntry` with updated values, increment `rule_version`

### Guardrails

- No rule can exist without at least one linked `CitationUnit`

---

## Workflow B: Per-Standard Evaluation

The R1 dashboard provides per-standard evaluation (SS 554, WELL v2, RESET Viral Index, SafeSpace), human-readable interpretations, metric preferences, and wellness scoring.

| Component | Path |
| --- | --- |
| Rule evaluation engine | `backend/app/skills/iaq_rule_governor/` |
| CSV parsing | `backend/app/skills/data_ingestion/` |
| Aggregation service | `backend/app/services/aggregation.py` |
| DB rule service | `backend/app/services/db_rule_service.py` |

---

## Key Reference Docs

- `docs/plans/epics/R1-Refactor/ROADMAP.md` — R1 roadmap (current)
- `docs/plans/MASTER_PLAN.md` — Original master plan
- `docs/plans/MASTER_PLAN-Refactor.md` — Refactor master plan (R1-R4)
- `docs/PSD-Refactor.md` — Product specification
- `docs/TDD-Refactor.md` — Technical design document
