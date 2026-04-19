# FJDashboard

> **FJ SafeSpace Wellness Platform — Dashboard Layer**

FJDashboard is the operational and reporting interface for the FJ SafeSpace Indoor Air Quality (IAQ) platform. It converts rule-based findings into role-appropriate, fully traceable views for internal analysts and FJ executives.

---

## Documents

| Document | File | Purpose |
| --- | --- | --- |
| PRD v1.1 | [`FJDashboard_PRD.md`](./docs/FJDashboard_PRD.md) | Product requirements |
| PSD-02 v0.2 | [`FJDashboard_PSD.md`](./docs/FJDashboard_PSD.md) | Product specification |
| TDD v0.1 | [`FJDashboard_TDD.md`](./docs/FJDashboard_TDD.md) | Technical design |
| Schema Reference | [`docs/SCHEMA_REFERENCE.md`](./docs/SCHEMA_REFERENCE.md) | All Supabase tables, columns, and data flow |
| Master Plan | [`docs/plans/MASTER_PLAN.md`](./docs/plans/MASTER_PLAN.md) | Phased roadmap and PR breakdown |

---

## Architecture

**Decoupled stack — Python backend + Next.js frontend.**

```text
frontend/      ← Next.js 15 App Router (Vercel)
backend/       ← FastAPI + SQLModel (Render)
docs/          ← Specifications, schema reference, plans, setup guides
```

Backend runs on **port 8000**. Frontend runs on **port 3000** and fetches from the backend via `NEXT_PUBLIC_API_URL`.

### Database

Production uses **Supabase Postgres** (`jertvmbhgehajcrfifwl`). Local development uses Docker Compose PostgreSQL on port 5432.

Full schema with 11 tables documented in [`docs/SCHEMA_REFERENCE.md`](./docs/SCHEMA_REFERENCE.md):

- **Workflow A (3 tables):** `reference_source`, `citation_unit`, `rulebook_entry` — IAQ rule governance
- **Supporting (2 tables):** `tenant`, `notification` — Phase 3 multi-tenant + alerts
- **Workflow B (5 tables):** `site`, `upload`, `reading`, `finding`, `report` — scan-to-report pipeline
- **Legacy (1 table):** `rulebook` — flat JSON structure, superseded by the 3-table Workflow A design

### PDF Engine

Reports use **immutable snapshots**: at approval time, the full rendered HTML is captured as JSON in the `report_snapshot` column. PDFs are generated on-demand from stored HTML via WeasyPrint, guaranteeing byte-for-byte reproducibility regardless of future template or CSS changes. No PDFs are stored in object storage.

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+ / pnpm
- Docker (for local PostgreSQL) **or** a Supabase project

### 1 — Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Fill in .env at project root (see .env.example)
alembic upgrade head          # run migrations
fastapi dev app/main.py       # starts on localhost:8000
```

### 2 — Frontend

```bash
cd frontend
pnpm install
pnpm dev                      # starts on localhost:3000
                              # reads NEXT_PUBLIC_API_URL from root .env
```

### 3 — Local Database (Docker)

```bash
docker compose up -d   # starts PostgreSQL on port 5432
```

### 4 — Seed Rulebook

```bash
python scripts/seed_rulebook.py   # Populates WHO AQG 2021 + SS554 entries
```

---

## Project Structure

```text
fjsafespace01/
├── backend/                  ← FastAPI backend
│   ├── app/
│   │   ├── main.py           ← FastAPI application entry point
│   │   ├── database.py       ← SQLAlchemy engine + session
│   │   ├── api/
│   │   │   ├── dependencies.py        ← DB session, auth stubs
│   │   │   └── routers/
│   │   │       ├── uploads.py         ← POST /api/uploads, GET /api/uploads/{id}, GET /api/uploads/{id}/findings
│   │   │       ├── dashboard.py       ← GET /api/dashboard/* (sites, zones, comparison, summary, executive)
│   │   │       ├── reports.py         ← POST/GET/PATCH /api/reports (create, list, qa-checklist, approve, export, pdf)
│   │   │       ├── rulebook.py        ← GET /api/rulebook/* (read-only)
│   │   │       └── notifications.py   ← GET/PATCH /api/notifications
│   │   ├── services/
│   │   │   ├── aggregation.py         ← Wellness Index, cross-site aggregation
│   │   │   ├── pdf_orchestrator.py    ← WeasyPrint HTML→PDF + snapshot builder
│   │   │   └── qa_gates.py            ← QA-G1 through QA-G8 evaluation
│   │   ├── skills/
│   │   │   ├── data_ingestion/        ← CSV parsing + Supabase Storage client
│   │   │   ├── iaq_rule_governor/     ← Rule evaluation engine
│   │   │   ├── report-template-stylist/ ← Template rendering
│   │   │   └── qa-compliance-gatekeeper/ ← QA compliance
│   │   ├── models/
│   │   │   ├── enums.py               ← All shared enums
│   │   │   ├── workflow_b.py          ← Site, Upload, Reading, Finding, Report
│   │   │   ├── workflow_a.py          ← ReferenceSource, CitationUnit, RulebookEntry
│   │   │   └── supporting.py          ← Tenant, Notification
│   │   ├── core/
│   │   │   └── config.py              ← Settings (loads from root .env)
│   │   ├── schemas/                   ← Pydantic request/response models
│   │   └── templates/                 ← Jinja2 HTML/CSS report templates
│   ├── migrations/            ← Alembic migrations (001–005)
│   │   └── versions/
│   └── tests/
│       ├── conftest.py                ← 86 lines of fixtures
│       ├── unit/                      ← 4 unit tests (aggregation, csv_parser, qa_gates, rule_engine)
│       └── integration/               ← upload_pipeline, report_pipeline, dashboard_endpoints
│
├── frontend/                 ← Next.js 15 App Router frontend
│   ├── app/
│   │   ├── layout.tsx         ← Root layout (fonts, global styles, nav shell)
│   │   ├── page.tsx           ← Redirects → /ops
│   │   ├── ops/               ← Operations view (Upload, Findings, Reports tabs)
│   │   └── executive/         ← Executive portfolio (results, suggestions, history)
│   ├── components/
│   │   ├── ui/                ← Shadcn primitives (button, card, dialog, etc.)
│   │   ├── CitationBadge.tsx
│   │   ├── CitationDrawer.tsx
│   │   ├── CrossSiteComparisonTable.tsx
│   │   ├── DailySummaryCard.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── QAChecklist.tsx
│   │   ├── ReportTypeBadge.tsx
│   │   ├── TrendChart.tsx
│   │   ├── UploadForm.tsx
│   │   ├── WellnessIndexCard.tsx
│   │   └── layout/            ← Navbar, Sidebar
│   ├── lib/
│   │   └── api.ts             ← Fetch client for FastAPI backend
│   ├── tests/
│   │   ├── components.test.tsx
│   │   └── wellness-index-card.test.tsx
│   └── package.json
│
├── scripts/
│   ├── seed_rulebook.py              ← Populates WHO AQG 2021 + SS554 rulebook entries
│   ├── run_qa_audit.py               ← Runs all 8 QA gates against an upload_id
│   └── preview_report.py             ← Renders report HTML template to PDF
│
├── assets/sample_uploads/
│   ├── npe_sample.csv                ← New Park Estate sample (3 zones, 24 rows, clean PASS)
│   └── cag_sample.csv                ← Changi Airport Group sample (3 zones, 30 rows, critical CO2)
│
├── docs/
│   ├── SCHEMA_REFERENCE.md           ← Full Supabase table documentation
│   ├── DESIGN_GUIDELINES.md          ← UI/UX design principles
│   ├── FJDashboard_PRD.md
│   ├── FJDashboard_PSD.md
│   ├── FJDashboard_TDD.md
│   ├── plans/
│   │   ├── MASTER_PLAN.md
│   │   └── epics/                    ← PR1–PR8 epic plans
│   └── setup/
│       └── SUPABASE_SETUP.md
│
├── .env                              ← Single environment file (all vars)
├── .env.example                      ← Template with placeholders
├── docker-compose.yml                ← Local PostgreSQL
└── README.md                         ← This file
```

---

## Phases

| Phase | Scope | Status |
| --- | --- | --- |
| **Phase 1** | Analyst view — upload, findings, report draft builder | ✅ Complete |
| **Phase 2** | Internal dashboard — Executive portfolio, leaderboard, zone drilldown | ✅ Complete |
| **Phase 3** | Customer portal — Clerk auth, tenant isolation, renewal workflow | ⏳ Gate-locked |

### Phase Gate Criteria

- **Phase 1 → 2:** ≥10 uploads processed; ≥95% parse success; citation completeness ≥95%.
- **Phase 2 → 3:** uHoo API feasibility confirmed; Clerk auth approved; legal disclaimer signed off by Jay Choy.

---

## Key Design Decisions

| Decision | Value |
| --- | --- |
| All processing | Synchronous — no background queues |
| Auth (Phase 1/2) | None — internal laptop only |
| Auth (Phase 3) | Clerk (Org = Tenant) |
| PDF generation | WeasyPrint (native Python) — on-demand from immutable HTML snapshots |
| Report storage | PostgreSQL `report_snapshot` column (TEXT) — no object storage for PDFs |
| File storage | Supabase Storage (`iaq-scans` bucket) — raw CSV uploads only |
| Rulebook access | Read-only (`SELECT` DB role) — no dashboard service may mutate Rulebook tables |
| Report types | `ASSESSMENT` \| `INTERVENTION_IMPACT` — auto-detected from timestamp span |
| Report immutability | Rendered HTML stored at approval time — PDFs always match what was approved |

See [`docs/SCHEMA_REFERENCE.md`](./docs/SCHEMA_REFERENCE.md) for full data flow diagram.
See [`FJDashboard_TDD.md`](./docs/FJDashboard_TDD.md) Section 19 (Decision Log) for the full decision log.

---

## Environment Variables

All variables are in a single `.env` file at the project root. See `.env.example` for the template.

| Variable | Required | Description |
| ------ | ------ | ------ |
| `DATABASE_URL` | Yes | PostgreSQL connection string (app role — SELECT-only on Rulebook tables) |
| `ADMIN_DATABASE_URL` | Yes | Full-access DB role for Workflow A admin console |
| `APPROVER_EMAIL` | Yes | Jay Choy's email — enforced by QA-G8 |
| `RESEND_API_KEY` | Yes | Email dispatch (Phase 2+) |
| `SUPABASE_URL` | For upload flow | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For upload flow | Supabase Storage service role key |
| `SUPABASE_STORAGE_BUCKET` | For upload flow | Storage bucket name (default: `iaq-scans`) |
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI backend base URL |
| `CLERK_SECRET_KEY` | Phase 3 only | Clerk secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Phase 3 only | Clerk publishable key |

---

## Testing

```bash
# Backend
cd backend
pytest tests/unit            # 4 unit tests
pytest tests/integration     # upload_pipeline, report_pipeline, dashboard_endpoints

# Frontend
cd frontend
pnpm test                    # Vitest + jsdom + testing-library
```

All 9 QA gate tests (QA-G1 through QA-G9) must pass before merging to `main`.

---

## Contributing

1. Branch from `main` — `feature/<ticket>` or `fix/<ticket>`.
2. Any change to schema, API contracts, or infrastructure requires a TDD version bump and Decision Log entry.
3. No rule/threshold override paths — any PR introducing one will be rejected.
4. Certification-impact changes require Jay Choy sign-off before merge.
5. Before committing schema changes, update [`docs/SCHEMA_REFERENCE.md`](./docs/SCHEMA_REFERENCE.md).
