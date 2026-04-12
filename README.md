# FJDashboard

> **FJ SafeSpace Wellness Platform — Dashboard Layer**

FJDashboard is the operational and reporting interface for the FJ SafeSpace Indoor Air Quality (IAQ) platform. It converts rule-based findings into role-appropriate, fully traceable views for internal analysts, FJ executives, and (Phase 3) customer tenants.

---

## Documents

| Document | File | Purpose |
|---|---|---|
| PRD v1.1 | [`FJDashboard_PRD.md`](./docs/FJDashboard_PRD.md) | Product requirements |
| PSD-02 v0.2 | [`FJDashboard_PSD.md`](./docs/FJDashboard_PSD.md) | Product specification |
| TDD v0.1 | [`FJDashboard_TDD.md`](./docs/FJDashboard_TDD.md) | Technical design |

---

## Architecture

**Decoupled stack — Python backend + Next.js frontend.**

```
frontend/      ← Next.js 15 App Router (Vercel)
backend/       ← FastAPI + SQLModel (Render)
docs/          ← Decisions, test data, runbooks
```

Backend runs on **port 8000**. Frontend runs on **port 3000** and fetches from the backend via `NEXT_PUBLIC_API_URL`.

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

cp .env.example .env          # fill in DATABASE_URL etc.
alembic upgrade head          # run migrations
fastapi dev app/main.py       # starts on localhost:8000
```

### 2 — Frontend

```bash
cd frontend
pnpm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
pnpm dev                           # starts on localhost:3000
```

### 3 — Local Database (Docker)

```bash
docker compose up -d   # starts PostgreSQL on port 5432
```

---

## Project Structure

```
fjsafespace01/
├── backend/                  ← FastAPI backend
│   ├── app/
│   │   ├── main.py           ← FastAPI application entry point
│   │   ├── database.py       ← SQLAlchemy engine + session
│   │   ├── api/
│   │   │   ├── dependencies.py        ← DB session, auth stubs
│   │   │   └── routers/
│   │   │       ├── uploads.py         ← POST/GET /api/uploads
│   │   │       ├── dashboard.py       ← GET /api/dashboard/*
│   │   │       ├── reports.py         ← POST/GET/PATCH /api/reports
│   │   │       ├── rulebook.py        ← GET /api/rulebook/* (read-only)
│   │   │       └── notifications.py   ← GET/PATCH /api/notifications
│   │   ├── services/
│   │   │   ├── csv_parser.py          ← CSV validation + normalisation
│   │   │   ├── rule_engine.py         ← Rule evaluation against Rulebook
│   │   │   ├── pdf_generator.py       ← WeasyPrint HTML→PDF orchestrator
│   │   │   └── wellness_index.py      ← FJ SafeSpace Wellness Index calculator
│   │   ├── models/
│   │   │   ├── enums.py               ← All shared enums
│   │   │   ├── workflow_b.py          ← Site, Upload, Reading, Finding, Report
│   │   │   ├── workflow_a.py          ← ReferenceSource, CitationUnit, RulebookEntry
│   │   │   └── supporting.py          ← Tenant, Notification
│   │   └── core/
│   │       └── config.py              ← Settings (env vars via pydantic-settings)
│   ├── migrations/            ← Alembic migrations
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── unit/              ← PyTest unit tests
│   │   └── integration/       ← PyTest integration tests
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                 ← Next.js 15 App Router frontend
│   ├── app/
│   │   ├── layout.tsx         ← Root layout (fonts, global styles, nav shell)
│   │   ├── page.tsx           ← Redirects → /dashboard
│   │   ├── dashboard/
│   │   │   ├── layout.tsx     ← Dashboard shell (sidebar + phase-aware nav)
│   │   │   ├── page.tsx       ← Role router → /analyst
│   │   │   ├── executive/     ← FJ Executive Portfolio view (Phase 2+)
│   │   │   └── analyst/       ← Analyst/Operations view (Phase 1+)
│   │   │       ├── page.tsx
│   │   │       ├── upload/    ← CSV upload form
│   │   │       ├── uploads/   ← Parse result + Findings Panel
│   │   │       └── reports/   ← Report preview + QA checklist
│   │   ├── admin/             ← Workflow A: Rulebook governance console
│   │   └── customer/          ← Phase 3 only (Clerk auth required)
│   │       └── status/        ← Wellness Index + certification status
│   ├── lib/
│   │   ├── api.ts             ← Fetch client for FastAPI backend
│   │   ├── email-templates/   ← Resend HTML email templates
│   │   └── components/
│   │       ├── dashboard/     ← WellnessIndexCard, DailySummaryCard
│   │       ├── analyst/       ← FindingsPanel, QAChecklist, UploadForm
│   │       ├── ops/           ← CrossSiteComparisonTable
│   │       └── shared/        ← CitationDrawer, SourceCurrencyBadge, TrendChart, etc.
│   ├── public/
│   ├── next.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.local.example
│
├── docs/
│   ├── decisions/             ← Architecture decision records (ADRs)
│   ├── test-data/             ← Sample CSV files for dry-runs (NPE, CAG)
│   ├── FJDashboard_PRD.md
│   ├── FJDashboard_PSD.md
│   └── FJDashboard_TDD.md
│
└── docker-compose.yml         ← Local PostgreSQL
```

---

## Phases

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Analyst view — upload, findings, report draft builder | 🔨 In development |
| **Phase 2** | Internal dashboard — Executive portfolio, leaderboard, zone drilldown | ⏳ Planned |
| **Phase 3** | Customer portal — Clerk auth, tenant isolation, renewal workflow | ⏳ Gate-locked |

### Phase Gate Criteria

- **Phase 1 → 2:** ≥10 uploads processed; ≥95% parse success; citation completeness ≥95%.
- **Phase 2 → 3:** uHoo API feasibility confirmed; Clerk auth approved; legal disclaimer signed off by Jay Choy.

---

## Key Design Decisions

| Decision | Value |
|---|---|
| All processing | Synchronous — no background queues |
| Auth (Phase 1/2) | None — internal laptop only |
| Auth (Phase 3) | Clerk (Org = Tenant) |
| PDF generation | WeasyPrint (native Python) |
| File storage | PostgreSQL `bytea` — no object storage |
| Rulebook access | Read-only (`SELECT` DB role) — no dashboard service may mutate Rulebook tables |
| Report types | `ASSESSMENT` \| `INTERVENTION_IMPACT` — same pipeline, different PDF template |

See [`FJDashboard_TDD.md`](./docs/FJDashboard_TDD.md) Section 19 (Decision Log) for the full decision log.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Always | PostgreSQL connection string (app DB role — limited to SELECT on Rulebook) |
| `ADMIN_DATABASE_URL` | ✅ Always | Full-access DB role for Workflow A admin console |
| `APPROVER_EMAIL` | ✅ Always | Jay Choy's email — enforced in QA-G8 |
| `RESEND_API_KEY` | ✅ Always | Email dispatch |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ Always | FastAPI backend base URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Phase 3 only | Clerk publishable key |
| `CLERK_SECRET_KEY` | Phase 3 only | Clerk secret key |

---

## Testing

```bash
# Backend
cd backend
pytest tests/unit
pytest tests/integration

# Frontend
cd frontend
pnpm test        # Vitest unit tests
pnpm e2e         # Playwright end-to-end
```

All 9 QA gate tests (QA-G1 through QA-G9) must pass before merging to `main`.

---

## Contributing

1. Branch from `main` — `feature/<ticket>` or `fix/<ticket>`.
2. Any change to schema, API contracts, or infrastructure requires a TDD version bump and Decision Log entry.
3. No rule/threshold override paths — any PR introducing one will be rejected.
4. Certification-impact changes require Jay Choy sign-off before merge.
