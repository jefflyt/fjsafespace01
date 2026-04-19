# FJDashboard — Backend

FastAPI backend for the FJ SafeSpace Wellness Platform dashboard.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env    # at project root, fill in DATABASE_URL, APPROVER_EMAIL, etc.
```

## Run (dev)

```bash
fastapi dev app/main.py    # hot-reload on localhost:8000
```

## Database migrations

```bash
# Start local DB
docker compose up -d   # from project root

# Apply all migrations
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "describe_change"
```

## Tests

```bash
pytest tests/unit
pytest tests/integration   # requires running DB
```

## Package Structure

```
app/
├── main.py           ← FastAPI app + router registration
├── database.py       ← SQLAlchemy engine + session
├── core/
│   └── config.py     ← pydantic-settings env config
├── api/
│   ├── dependencies.py    ← DB session + Phase 3 auth stub
│   └── routers/
│       ├── uploads.py
│       ├── dashboard.py
│       ├── reports.py
│       ├── rulebook.py    ← READ-ONLY; mutations return 405
│       └── notifications.py
├── services/
│   ├── csv_parser.py      ← CSV validation + normalisation
│   ├── rule_engine.py     ← Deterministic rule evaluation
│   ├── pdf_generator.py   ← WeasyPrint HTML→PDF
│   └── wellness_index.py  ← FJ Wellness Index calculator
└── models/
    ├── enums.py            ← All shared enums
    ├── workflow_b.py       ← Site, Upload, Reading, Finding, Report
    ├── workflow_a.py       ← RulebookEntry, CitationUnit, ReferenceSource (read-only)
    └── supporting.py       ← Tenant, Notification
```

## Key Governance Rules

- **No manual threshold override** — any attempt returns `403` at service boundary.
- **Rulebook is read-only** — app DB role has `SELECT` only on rulebook tables.
- **QA-G5**: every finding must include `rule_version` + `citation_unit_ids` or report generation returns `422`.
- **QA-G8**: `APPROVED` status transition requires `reviewer_name == APPROVER_EMAIL`.
- **INSUFFICIENT_EVIDENCE**: `certificationOutcome` is never `null`.
