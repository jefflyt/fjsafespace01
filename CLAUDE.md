# FJDashboard — CLAUDE.md

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
```

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
- `backend/app/models/`: SQLModel definitions split by workflow (A and B).
- `backend/app/services/`: Core logic for CSV parsing, rule evaluation, and PDF orchestration.
- `backend/app/templates/`: WeasyPrint HTML/CSS report templates (Jinja2 syntax).
- `frontend/app/analyst/`: Primary operational interface for Phase 1.
- `frontend/lib/api.ts`: Centralized fetch client for backend communication.

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
