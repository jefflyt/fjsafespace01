# PR Plan: PR-R1-03 — Schema Additions (Preferences, Standards, Context)

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-03 depends on PR-R1-02 — `reference_source` table must exist for FK
- **Scope boundaries**: Scope (in) = migrations 008-011, SQLModel classes. Scope (out) = API endpoints, frontend UI
- **Risks**: Review trade-off #4 (TEXT[] for active_metrics) — simpler than JSONB for flat enum lists
- **Status**: Verify PR-R1-02 is merged, rulebook reorganization complete

**Post-Completion Check**: After merging, re-read ROADMAP.md to verify:

- All scope (in) items are delivered, scope (out) items are untouched
- Next PR (PR-R1-04) dependency is satisfied: schema tables exist for API endpoints
- Run `alembic upgrade head` — verify no migration conflicts

## 1) Assumptions

- Migrations 001-007 exist. Migrations 014 (user_tenant) and 015 (rulebook_standard_link) from prior PRs exist.
- New migrations 008-011 are numbered by topic, not execution order. Alembic revision chain handles execution order.
- `site` table exists with columns: id, name, tenant_id, created_at.
- `upload` table exists with columns: id, site_id, file_name, uploaded_by, uploaded_at, parse_status, parse_outcome, report_type, rule_version_used, warnings.
- TEXT[] PostgreSQL array type supported (per D-R1-09).
- Site model in `backend/app/models/workflow_b.py`.

## 1) Feature Summary

- **Goal**: Create database tables and columns needed for per-site metric preferences, standard selection, and scan tracking
- **User Story**: As a facility manager, I want to customize which metrics I see and adjust alert thresholds so that my dashboard is relevant to my site's needs.
- **Acceptance Criteria**:
  1. `site_metric_preferences` table exists with UNIQUE site_id, active_metrics TEXT[], alert_threshold_overrides JSONB
  2. `site_standards` table exists with UNIQUE (site_id, reference_source_id) constraint
  3. `site` table has new columns: context_scope TEXT, standard_ids TEXT[]
  4. `upload` table has new columns: scan_type TEXT, standards_evaluated TEXT[]
  5. All migrations apply cleanly on existing data (additive, nullable columns with defaults)
  6. SQLModel classes reflect new schema
- **Non-goals**: API endpoints for preferences (deferred to PR-R1-04), frontend UI for preferences (deferred to PR-R1-05)

## 2) Approach Overview

- **Proposed Data**: 4 new migrations (008-011), all additive. No data modification.
- **Proposed Backend**: New SQLModel classes in supporting.py and workflow_b.py. No API changes.

## 3) PR Plan

### PR Title: `feat(R1-03): schema additions for preferences, standards, context`
### Branch Name: `r1-03-schema-additions`

### Key Changes by Layer

**Backend:**

1. **Migration 008_site_context** (`backend/migrations/versions/008_site_context.py`)
   - down_revision: `'007_tenant_customer_info'` (chains from last existing migration)
   - Add `context_scope` column to site table: TEXT, default 'general', nullable
   - Add `standard_ids` column to site table: TEXT[] (PostgreSQL array), default '{}', nullable
   - downgrade: drop both columns

2. **Migration 009_scan_type** (`backend/migrations/versions/009_scan_type.py`)
   - down_revision: `'008_site_context'`
   - Add `scan_type` column to upload table: TEXT, default 'adhoc', nullable
   - Add `standards_evaluated` column to upload table: TEXT[], default '{}', nullable
   - downgrade: drop both columns

3. **Migration 010_site_metric_preferences** (`backend/migrations/versions/010_site_metric_preferences.py`)
   - down_revision: `'009_scan_type'`
   - Create `site_metric_preferences` table:
     - id: String(36) PK
     - site_id: String(36) FK site.id, NOT NULL, UNIQUE (one row per site)
     - active_metrics: TEXT[] NOT NULL, default '{}'
     - alert_threshold_overrides: JSONB NOT NULL, default '{}'
     - created_at: DateTime NOT NULL, default now()
     - updated_at: DateTime NOT NULL, default now()
   - downgrade: drop_table('site_metric_preferences')

4. **Migration 011_site_standards** (`backend/migrations/versions/011_site_standards.py`)
   - down_revision: `'010_site_metric_preferences'`
   - Create `site_standards` table:
     - id: String(36) PK
     - site_id: String(36) FK site.id, NOT NULL
     - reference_source_id: String(36) FK reference_source.id, NOT NULL
     - is_active: Boolean NOT NULL, default true
     - created_at: DateTime NOT NULL, default now()
   - Unique constraint: (site_id, reference_source_id)
   - downgrade: drop_table('site_standards')

5. **Model update** (`backend/app/models/workflow_b.py`)
   - Add to Site: `context_scope: Optional[str] = Field(default=None)`, `standard_ids: Optional[list[str]] = Field(default=None)`
   - Add to Upload: `scan_type: Optional[str] = Field(default=None)`, `standards_evaluated: Optional[list[str]] = Field(default=None)`

6. **Model update** (`backend/app/models/supporting.py`)
   - Add `SiteMetricPreferences` SQLModel class matching migration 010 schema
   - Add `SiteStandards` SQLModel class matching migration 011 schema

7. **Enum update** (`backend/app/models/enums.py`)
   - Add `ScanType` enum: `adhoc = "adhoc"`, `continuous = "continuous"` (if not present)

**Frontend:**

- No frontend changes (purely schema)

### Edge Cases to Handle

- Existing sites without preferences → no row in site_metric_preferences (default to empty active_metrics)
- Migration 008-011 revision chain must be linear — each down_revision points to previous
- TEXT[] columns need PostgreSQL-specific type — use `sa.ARRAY(sa.Text())` in Alembic
- UNIQUE on site_metric_preferences.site_id means at most one preference row per site

## 4) Testing & Verification

### Manual Verification Checklist
1. `alembic upgrade head` succeeds
2. `\d site_metric_preferences` in psql shows correct schema with UNIQUE constraint on site_id
3. `\d site_standards` shows composite unique constraint (site_id, reference_source_id)
4. `\d site` shows new context_scope and standard_ids columns
5. `\d upload` shows new scan_type and standards_evaluated columns
6. Existing data unchanged — all sites and uploads still queryable
7. SQLModel classes import without error

### Commands to Run
```bash
cd backend && alembic upgrade head
psql -c "\d site_metric_preferences"
psql -c "\d site_standards"
cd backend && python -c "from app.models.supporting import SiteMetricPreferences, SiteStandards; print('OK')"
```

## 5) Rollback Plan

1. `alembic downgrade 007_tenant_customer_info` — reverses all 4 new migrations in correct order
2. Each downgrade drops its table/columns cleanly — no data loss
3. Revert SQLModel changes in workflow_b.py and supporting.py

## 6) Follow-ups

- API endpoints for preferences (PR-R1-04)
- Frontend UI for metric selector and threshold config (PR-R1-05)
- Auto-create default site_metric_preferences row when a new site is created
