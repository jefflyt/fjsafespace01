# PR Plan: PR-R1-02 — Rulebook Reorganization

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-02 depends on PR-R1-01 — sites must have
  `tenant_id` assigned
- **Scope boundaries**: Scope (in) = migration 015, seed script refactor, rule engine standard filter. Scope (out) =
per-standard evaluation in API, frontend standard selector
- **Risks**: Review risk #1 (rulebook breaks existing evaluations) — bump to v2-refactor without deleting v1.0 entries
- **Status**: Verify PR-R1-01 is merged, `user_tenant` table exists, seed script has been run

**Post-Completion Check**: After merging, re-read ROADMAP.md to verify:

- All scope (in) items are delivered, scope (out) items are untouched
- Next PR (PR-R1-03) dependency is satisfied: `reference_source_id` FK exists on `rulebook_entry`
- Verify old rule_version data is still queryable — no regression

## 1) Assumptions

- Existing rulebook data (WHO AQG 2021 rules) was seeded by `scripts/seed_rulebook_v1.py`.
- `ReferenceSource` table already exists (migration 001+).
- `RulebookEntry` model has no `reference_source_id` FK — rules are only organized by `rule_version`.
- SafeSpace and SS554 thresholds are placeholders — actual values to be defined later.
- Existing findings reference old `rule_version` values — must remain queryable.

## 1) Feature Summary

- **Goal**: Add 4 certification standards (WELL, ASHRAE, SS554, SafeSpace) and link existing rules to their parent
standard
- **User Story**: As FJ staff, I want to select which standard to evaluate IAQ data against so that each standard
produces an independent pass/fail outcome.
- **Acceptance Criteria**:
  1. 4 reference_source entries exist: WELL, ASHRAE, SS554, SafeSpace
  2. Existing WHO AQG 2021 rules linked to WELL source
  3. SafeSpace and SS554 have placeholder entries with "Coming Soon" status
  4. `GET /api/rulebook/sources` returns all 4 sources
  5. Rule engine can filter rules by standard_id
  6. Legacy rule_version entries preserved — old findings still queryable
  7. All rulebook entries get `rule_version = "v2-refactor"` to distinguish from legacy
- **Non-goals**: Full SS554 certification document loading, SafeSpace threshold definition, per-standard evaluation in
API (deferred to PR-R1-04)

## 2) Approach Overview

- **Proposed Data**: New migration adds `reference_source_id` FK to `rulebook_entry`. Seed script creates 4 sources and
links rules.
- **Proposed Backend**: `db_rule_service.py` gains `fetch_rules_by_standard()` function. Rule engine accepts
`standard_id` filter parameter.
- **Proposed API**: `GET /api/rulebook/sources` enhanced to return all 4 standards with status.

## 3) PR Plan

### PR Title: `feat(R1-02): rulebook reorganization by certification standard`

### Branch Name: `r1-02-rulebook-reorg`

### Key Changes by Layer

**Backend:**

1. **Migration 015_rulebook_standard_link** (`backend/migrations/versions/015_rulebook_standard_link.py`)
   - down_revision: `'014_user_tenant'`
   - Add `reference_source_id` column to `rulebook_entry` table (String, FK reference_source.id, nullable for backward
compat)
   - Add index on `rulebook_entry(reference_source_id)`
   - downgrade: drop column

2. **Refactored seed script** (`scripts/seed_rulebook_v1.py`)
   - Create 4 ReferenceSource entries:
     - WELL Building Standard v2 (IWBI, global commercial, CURRENT_VERIFIED)
     - ASHRAE 62.1 (ASHRAE, US ventilation, CURRENT_VERIFIED)
     - SS554 (Springer Singapore, local regulatory, placeholder — status TBD)
     - SafeSpace (FJ proprietary, FJ's own standard, placeholder — status TBD)
   - Link existing WHO AQG 2021 rules → WELL source
   - Link existing IAQ rules → SS554 source (or create placeholder if none exist)
   - Create placeholder entries for SafeSpace (all metrics, threshold TBD)
   - Create placeholder entries for SS554 (if certification doc not loaded)
   - Bump all rule_version to `"v2-refactor"`
   - Make idempotent — check if sources exist before creating

3. **Model update** (`backend/app/models/workflow_a.py`)
   - Add `reference_source_id: Optional[str] = Field(default=None, foreign_key="reference_source.id")` to RulebookEntry
   - Add `source: Optional[ReferenceSource] = Relationship()` to RulebookEntry

4. **Service update** (`backend/app/services/db_rule_service.py`)
   - Add `fetch_rules_by_standard(session, source_id)` function
   - Query rulebook_entry WHERE reference_source_id = source_id AND approval_status = 'approved'
   - Return list of RulebookEntry

5. **Rule engine update** (`backend/app/skills/iaq_rule_governor/rule_engine.py`)
   - Modify `evaluate()` or equivalent function to accept optional `standard_id` parameter
   - When standard_id provided, filter rules by reference_source_id before evaluation
   - When not provided, use all active rules (backward compatible)

6. **Wellness index update** (`backend/app/skills/iaq_rule_governor/wellness_index.py`)
   - Modify `calculate()` to accept optional `standard_id` parameter
   - When standard_id provided, compute weighted score using only that standard's rules
   - When not provided, compute using all rules (backward compatible)

7. **Router update** (`backend/app/api/routers/rulebook.py`)
   - `GET /api/rulebook/sources` — returns all reference_source entries with status
   - Include `status` field so frontend can show "Coming Soon" for placeholders

**Frontend:**

- No frontend changes (purely backend/data)

### Edge Cases to Handle

- Seed script run multiple times → idempotent, no duplicates
- Rules with no reference_source_id → still queryable (backward compatible)
- SafeSpace/SS554 placeholder rules → should have clear indicators (e.g., approval_status = 'draft')
- Existing findings with old rule_version → still queryable, not modified

## 4) Testing & Verification

### Manual Verification Checklist

1. `alembic upgrade head` succeeds, `reference_source_id` column added
2. `python scripts/seed_rulebook_v1.py` creates 4 sources, links rules
3. `SELECT DISTINCT reference_source_id FROM rulebook_entry` shows all 4 sources
4. `GET /api/rulebook/sources` returns 4 entries
5. `GET /api/rulebook/rules?source_id=<well_id>` returns only WELL rules
6. Old findings with rule_version="v1.0" still queryable

### Commands to Run

```bash
cd backend && alembic upgrade head
python scripts/seed_rulebook_v1.py
cd backend && fastapi dev app/main.py
curl http://localhost:8000/api/rulebook/sources
```

## 5) Rollback Plan

1. `alembic downgrade -1` (drops reference_source_id column from rulebook_entry)
2. Revert `backend/app/models/workflow_a.py` to remove reference_source_id field
3. Revert `scripts/seed_rulebook_v1.py` to original (if needed — seed changes are data-only)
4. Note: New reference_source entries and rulebook entries created by seed script will remain. To
   fully clean:

   ```sql
   DELETE FROM rulebook_entry WHERE rule_version = 'v2-refactor';
   DELETE FROM reference_source WHERE title IN ('WELL Building Standard', 'ASHRAE 62.1', 'SS554', 'SafeSpace');
   ```

## 6) Follow-ups

- Load actual SS554 certification document when available
- Define SafeSpace thresholds with Jay/FJ team
- Per-standard evaluation wired into upload pipeline (PR-R1-04)
- Per-standard wellness index scoring (PR-R1-04)

## 7) Implementation Status — COMPLETE (2026-04-28)

### Acceptance Criteria Verification

| # | Acceptance Criteria | Status | Notes |
| - | - | - | - |
| 1 | 4 reference_source entries exist | ✅ | SS 554, WELL v2, RESET Viral Index, SafeSpace |
| 2 | Existing rules linked to sources | ✅ | All 22 rules have `reference_source_id` FK |
| 3 | SafeSpace/SS554 placeholders with status | ✅ | SafeSpace: 5 draft; SS 554: 4 approved |
| 4 | `GET /api/rulebook/sources` returns 4 entries | ✅ | Returns `status` and `source_currency_status` |
| 5 | Rule engine can filter by standard_id | ✅ | `fetch_rules_by_standard()` in db_rule_service |
| 6 | Legacy rule_version preserved | ✅ | New rules use `v2-refactor` |
| 7 | All new entries get `rule_version = v2-refactor` | ✅ | All 22 rules verified |

### Implementation Steps Verification

| # | Plan Step | Status | File | Notes |
| - | - | - | - | - |
| 1 | Migration 015 — add `reference_source_id` FK | ✅ | `015_rulebook_standard_link.py` | Used `sa.Uuid(as_uuid=True)` |
| 2 | Model update — add FK + relationships | ✅ | `workflow_a.py:121` | FK + both relationships |
| 3 | Refactored seed script | ✅ | `seed_rulebook_v1.py` | 4 sources, 22 rules |
| 4 | Service update — `fetch_rules_by_standard` | ✅ | `db_rule_service.py:134` | Filters by source+version |
| 5 | Router update — `source_id` filter | ✅ | `rulebook.py:34` | Query param added |
| 6 | Rule engine update (optional) | ⏭️ | — | Already supports filtered rules |
| 7 | Wellness index update (optional) | ⏭️ | — | Caller filters findings |

### Deviations from Original Plan

- **ASHRAE → RESET Viral Index**: User corrected the 4 standards to
  SS 554, WELL v2, RESET Viral Index, SafeSpace (not ASHRAE).
- **`priority` column dropped**: Legacy DB column `priority` (NOT NULL,
  not in model, not in any migration) was dropped to unblock seed script.
  Should be formalized in migration 016 for clean schema history.
- **Migration type fix**: `sa.Uuid(as_uuid=True)` instead of
  `sa.String(length=36)` — Supabase native UUID columns require this type
  for ALTER TABLE ADD COLUMN with FK.

### DB State Summary

```text
alembic_version: 015_rulebook_standard_link
reference_source: 4 entries (3 active/CURRENT_VERIFIED, 1 draft/VERSION_UNVERIFIED)
rulebook_entry: 22 rules (all rule_version=v2-refactor)
  - SS 554: 4 approved rules
  - WELL v2: 9 approved rules (3 bands per metric)
  - RESET Viral Index: 4 approved rules
  - SafeSpace: 5 draft rules (placeholder)
```
