# Epic Plan: PR7 - Workflow A: Rulebook Population (Phase 1)

**Status: COMPLETE (2026-04-19)** — All 3 sub-tasks implemented, seeded, and verified.

## 1. Feature/Epic Summary

- **Objective**: Populate the Rulebook tables with IAQ thresholds from certification standards (WHO AQG 2021, SS554, etc.) so that Workflow B (Scan-to-Report) has rules to evaluate CSV readings against. The rulebook is the single source of truth for all report generation.
- **User Impact**: Without rules in the database, all findings return "Insufficient Evidence." This is a foundational gap that blocks PR2 (rule evaluation), PR3 (citation badges), PR4 (QA gates), and PR5 (PDF generation).
- **Dependencies**: None from prior PRs — this is a parallel/preceding track. Requires the database migration fix (GUID type compatibility) before any tables can be created.

## 2. Complexity & Fit

- **Classification**: Single PR (3 sub-tasks)
- **Rationale**: Rather than building a full admin CRUD console with approval workflows and version tracking, we use a **seed script approach**. Standards are curated by a human reading the PDF and encoding the thresholds directly in code. This is pragmatic: we have ~3-5 standards that change infrequently (annually at most). A full admin UI adds hundreds of lines of code, form validation, and dual-DB role complexity for very little value in Phase 1/2.

## 3. Full-Stack Impact

- **Frontend**: No admin UI needed in Phase 1/2. The existing `/admin` page can remain as a placeholder. No new frontend components.
- **Backend**: Database migration fix (GUID type), seed script to populate rulebook tables, and implementation of the existing stubbed GET routes in `rulebook.py` so Workflow B can consume rulebook data.
- **Data**: Workflow A tables already defined in migration 001 but never created due to `sqlmodel.sql.sqltypes.GUID` incompatibility. No new schema fields needed — the existing model is complete.

---

## 4. PR Roadmap

### PR 7.1: Database Migration Fix ✅ COMPLETE

- **Goal**: Fix the Alembic migration GUID type incompatibility so all tables can be created.
- **Scope (in)**:
  - Fix `sqlmodel.sql.sqltypes.GUID` import error — replaced with `sa.String(length=36)` in migration (matches the model's `str(uuid4())` approach).
  - Fixed duplicate `upload_id`/`site_id` columns on `report` table.
  - Added `citation_unit_ids` column to `rulebook_entry`.
  - Fixed `alembic.ini` interpolation error — uses programmatic override in `env.py`.
  - Verify `alembic upgrade head` creates all tables including Workflow A tables (`reference_source`, `citation_unit`, `rulebook_entry`).
- **Scope (out)**: No admin UI, no CRUD routes, no dual-DB role wiring. Infrastructure only.
- **Key Changes**: `backend/migrations/versions/001_initial_tables.py`, `backend/alembic.ini`, `backend/app/models/workflow_a.py`
- **Testing**: `alembic upgrade head` succeeds. All 9 tables exist in PostgreSQL.

### PR 7.2: Rulebook Seed Script ✅ COMPLETE

- **Goal**: A Python script that populates the rulebook with WHO AQG 2021 and SS554 thresholds.
- **Scope (in)**:
  - `scripts/seed_rulebook_v1.py` — creates ReferenceSource, CitationUnit, and RulebookEntry records for:
    - **WHO AQG 2021** — PM2.5 annual (5 µg/m³), PM2.5 24h (15 µg/m³), TVOC (300 µg/m³).
    - **SS554** — CO2 (1000 ppm), PM2.5 (35 µg/m³), Temperature (23–26°C), Humidity (40–70%RH).
  - All entries created with `approval_status=approved`, `rule_version=v1.0`, `source_currency_status=CURRENT_VERIFIED`.
  - Script is idempotent — safe to re-run without creating duplicates.
  - `index_weight_percent` values set: CO2 25%, PM2.5 20%, TVOC 15%, Temp 10%, Humidity 10%.
- **Scope (out)**: No admin UI, no API routes, no LLM-assisted extraction (deferred — see Future Features).
- **Key Changes**: `scripts/seed_rulebook_v1.py` (new file), `backend/app/models/workflow_a.py` (added `citation_unit_ids`).
- **Testing**: Seed script ran successfully — 2 sources, 7 citations, 7 approved rules populated.

### PR 7.3: Rulebook Read-Only API + Dashboard Integration ✅ COMPLETE

- **Goal**: Implement the existing stubbed GET routes in `rulebook.py` so Workflow B can consume rulebook data.
- **Scope (in)**:
  - Implemented `GET /api/rulebook/rules` — returns approved RulebookEntry[] with filters (metricName, contextScope, approvalStatus, includeSuperseded).
  - Implemented `GET /api/rulebook/rules/{id}` — returns a single rule with linked citation_units.
  - Implemented `GET /api/rulebook/sources` — returns ReferenceSource[] with sourceCurrencyStatus.
  - Read-only enforced — only GET routes defined (PUT/POST/DELETE return 405 automatically).
  - Aggregation service (`backend/app/services/aggregation.py`) already wired to real rulebook data via `_get_rulebook_weights`.
- **Scope (out)**: No admin UI. No write endpoints.
- **Key Changes**: `backend/app/api/routers/rulebook.py` (replaced all 501 stubs with working implementations).
- **Testing**: All three endpoints return correct data. Filters work (metric_name, context_scope). 404 for missing rule IDs.

---

## 5. Milestones & Sequence ✅ ALL COMPLETE

```text
PR 7.1 (DB migration fix)              ✅ Complete
  -> PR 7.2 (Seed script populates WHO AQG 2021 + SS554)   ✅ Complete
    -> PR 7.3 (Read-only API + dashboard integration)      ✅ Complete
```

All three sub-tasks implemented, seeded, and verified against the running database (2026-04-19).

---

## 6. Risks, Trade-offs, and Open Questions

### Risks

| Risk | Impact | Mitigation |
| ------ | ------ | ------ |
| **R1: SQLModel GUID compatibility** | Blocks all database access | PR 7.1 addresses this directly. Use `sa.String(length=36)` to match model's `str(uuid4())` approach. |
| **R2: Seed script accuracy** | Wrong thresholds in seed script → wrong findings → wrong reports | Seed script values must be cross-referenced against actual WHO AQG 2021 and SS554 documents. Jay Choy must approve before use in production reports. |
| **R3: Standard updates** | When WHO or SS554 publish new editions, the seed script must be manually updated | Document the process. When a standard updates: edit the seed script, bump `rule_version` to `v2.0`, mark old entries as `superseded`, re-run. |
| **R4: Manual burden for new standards** | Adding a new standard requires code changes and re-running the seed script | Acceptable for Phase 1/2 (3-5 standards, infrequent changes). Future enhancement: LLM-assisted PDF extraction (see Future Features). |

### Trade-offs

| Decision | Rationale |
| ------ | ------ |
| **Seed script over admin CRUD** | Standards change infrequently. A full admin console (CRUD, approval workflows, version tracking, dual-DB roles) adds hundreds of lines of code for minimal Phase 1/2 value. Seed script is accurate, auditable (code review), and instant. |
| **No admin UI in Phase 1/2** | The `/admin` page remains a placeholder. When standards need updating, the developer edits the seed script and re-runs. This is faster and less error-prone than a web form for the expected scale. |
| **bytea storage for PDFs** | Matches existing TDD decision. Can migrate to Supabase Storage later if file sizes grow. |
| **Approved-only entries in seed** | All seed entries are created as `approval_status=approved` with `approved_by="Jay Choy (seed)"`. In a future admin UI, a proper approval workflow can be added. |

### Open Questions

1. **Q1: Seed script scope** — Should the seed include WHO AQG 2021 + SS554 fully, or leave it minimal? Recommendation: include both standards fully — it saves manual setup and serves as the initial rulebook.

2. **Q2: Rule version numbering** — Current schema uses `rule_version: str`. Recommendation: use `v1.0`, `v2.0` format — simple, ordered, human-readable.

3. **Q3: Should superseded rules be visible in the read-only API?** — Currently `GET /api/rulebook/rules` only returns `approved` entries. Recommendation: add `?include_superseded=true` query param for audit/history access.

---

## 7. Future Features (Deferred)

### Feature: LLM-Assisted Standard Ingestion (Option B)

**Description**: Upload a PDF standard → LLM reads and extracts citation units and threshold values → creates draft rulebook entries → human reviews and approves.

**Why deferred**:

- Complex to build reliably (PDF layouts vary, tables are hard, hallucination risk).
- Needs LLM API costs and infrastructure.
- Essentially a whole product on its own.
- Not needed for Phase 1/2 — we have a known, small set of standards.

**When to revisit**: When you need to ingest new or unknown standards regularly, or when the manual seed script update burden becomes significant.

**High-level architecture** (for future reference):

1. PDF upload → text extraction (PyPDF2 / pdfplumber).
2. LLM prompt: extract IAQ thresholds, metrics, units, and context from the text.
3. Validate extracted data against known metric names and units.
4. Create draft `CitationUnit` and `RulebookEntry` records with low confidence.
5. Human review in admin UI: confirm/edit/approve entries.
6. Approved entries promoted to runtime Rulebook.

**Risks**:

- LLM hallucination — extracted thresholds may be wrong.
- PDF parsing failures — scanned documents, complex layouts, tables.
- Requires human-in-the-loop review regardless; the seed script is effectively the same workflow but done manually.

---

*Revised 2026-04-18: Replaced admin CRUD console approach with seed script. Original plan (PR 7.1-7.6 with full admin UI, approval workflows, dual-DB roles) was overkill for Phase 1/2 scale.*
