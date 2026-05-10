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

```text
app/
├── main.py           ← FastAPI app + router registration
├── database.py       ← SQLAlchemy engine + session
├── core/
│   └── config.py     ← pydantic-settings env config
├── api/
│   ├── dependencies.py    ← Supabase JWT extraction, tenant scoping
│   └── routers/
│       ├── uploads.py         ← POST uploads, preview, confirm, GET findings
│       ├── dashboard.py       ← sites, zones, comparison, summary, executive
│       ├── reports.py         ← CRUD + QA + PDF generation
│       ├── rulebook.py        ← READ-ONLY; mutations return 405
│       ├── notifications.py   ← list + mark read
│       ├── preferences.py     ← metric preferences + site standards
│       ├── interpretations.py ← threshold band → plain-language text
│       └── tenants.py         ← list + search tenants
├── services/
│   ├── aggregation.py         ← Wellness Index, cross-site aggregation
│   ├── db_rule_service.py     ← fetch rules by standard
│   └── wellness_index.py      ← FJ Wellness Index calculator
├── skills/
│   ├── data_ingestion/        ← CSV parsing + Supabase Storage client
│   └── iaq_rule_governor/     ← Rule evaluation engine
└── models/
    ├── enums.py               ← All shared enums (15 metrics)
    ├── workflow_b.py          ← Site, Upload, UploadBatch, Reading, Finding, Report
    ├── workflow_a.py          ← RulebookEntry, CitationUnit, ReferenceSource
    └── supporting.py          ← Tenant, Notification, UserTenant, SiteMetricPreferences, SiteStandards
```

## Key Governance Rules

- **No manual threshold override** — any attempt returns `403` at service boundary.
- **Rulebook is read-only** — app DB role has `SELECT` only on rulebook tables.
- **QA-G5**: every finding must include `rule_version` + `citation_unit_ids` or report generation returns `422`.
- **QA-G8**: `APPROVED` status transition requires `reviewer_name == APPROVER_EMAIL`.
- **INSUFFICIENT_EVIDENCE**: `certificationOutcome` is never `null`.
