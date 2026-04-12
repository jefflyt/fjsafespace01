# FJDashboard — GEMINI.md

## Project Overview
FJDashboard is the operational and reporting interface for the FJ SafeSpace Indoor Air Quality (IAQ) platform. It processes rule-based findings into traceable reports for analysts, executives, and customer tenants.

### Core Architecture
- **Backend:** FastAPI (Python 3.12+), SQLModel (SQLAlchemy), Alembic for migrations.
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI.
- **Database:** PostgreSQL (local via Docker Compose, production via Render/Supabase).
- **PDF Engine:** WeasyPrint (native Python HTML-to-PDF).
- **Workflows:** 
    - **Workflow A:** Standards governance (Reference Vault & Rulebook).
    - **Workflow B:** Scan-to-Report operations (Upload -> Findings -> Report).

---

## Technical Commands

### 1. Backend (Python)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # Apply migrations
fastapi dev app/main.py       # Start dev server on port 8000
pytest tests/unit             # Run unit tests
pytest tests/integration      # Run integration tests
```

### 2. Frontend (Next.js)
```bash
cd frontend
pnpm install
pnpm dev                      # Start dev server on port 3000
pnpm test                     # Run Vitest unit tests
```

### 3. Infrastructure
```bash
docker compose up -d          # Start local PostgreSQL on port 5432
```

---

## Development Conventions

### 1. Traceability & Governance
- **Mandatory Metadata:** Every finding **must** include a `rule_version` and `citation_id`.
- **Read-Only Rulebook:** The dashboard (Workflow B) must **never** mutate Rulebook tables. Access is limited to `SELECT` only at the DB level.
- **No Manual Overrides:** Threshold overrides in production are strictly prohibited.

### 2. QA Gates
All 9 QA gate tests (QA-G1 to QA-G9) must pass before merging to `main`. These enforce data quality statements, citation completeness, and reviewer authorization (Jay Choy as the final approver).

### 3. Design Principles
- **Evidence Before Aesthetics:** Accuracy and traceability take precedence over visual flair.
- **Synchronous Pipeline:** All processing (parsing and PDF generation) is currently synchronous.
- **Surgical Updates:** When modifying the schema or API contracts, ensure the TDD version is bumped and recorded in the Decision Log.

---

## Key Files & Directories
- `docs/`: Authority for PRD, PSD, and TDD specifications.
- `backend/app/models/`: SQLModel definitions split by workflow (A and B).
- `backend/app/services/`: Core logic for CSV parsing, rule evaluation, and PDF orchestration.
- `frontend/app/analyst/`: Primary operational interface for Phase 1.
- `frontend/lib/api.ts`: Centralized fetch client for backend communication.
