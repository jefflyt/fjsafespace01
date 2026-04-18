# Epic Plan: PR7 - Workflow A: IAQ Rule Governor (Phase 1)

## 1. Feature/Epic Summary

- **Objective**: Build the admin console that allows authorized users to ingest certification standards (WHO, BCA, SS554, etc.), extract citation units, draft/approve rulebook entries, and manage threshold versioning. This is the governance layer that powers the rule evaluation engine used by Workflow B.
- **User Impact**: Without this feature, the system has no rules to evaluate against — all findings would return "Insufficient Evidence." This is a foundational gap that blocks PR2 (rule evaluation), PR3 (citation badges), PR4 (QA gates), and PR5 (PDF generation).
- **Dependencies**: None from prior PRs — this is a parallel/preceding track. Requires the database migration fix (GUID type compatibility) before any routes work.

## 2. Complexity & Fit

- **Classification**: Multi-PR (6 PRs)
- **Rationale**: This epic spans three distinct concern areas — (a) infrastructure fix to unblock all database access, (b) a full admin CRUD backend with dual-DB-role routing, and (c) a multi-step admin UI with validation, approval workflows, and versioning. Each concern touches different layers (backend routes, admin frontend, migration, service logic) and should be merged independently for safe testing.

## 3. Full-Stack Impact

- **Frontend**: Single-page admin at `/admin` using a 3-tab layout (Sources | Citations | Rulebook) with inline editing via dialogs. No nested routes, no separate detail pages. Reuses existing Shadcn components (Table, Badge, Dialog, Select, Input, Textarea, Card). New lightweight components: `SourceCurrencyBadge`, `StatusPill`, `InlineEditor`. Admin gets a navbar link in [Navbar.tsx](frontend/components/layout/Navbar.tsx).

- **Backend**: Admin-only CRUD routes for ReferenceSource, CitationUnit, RulebookEntry under `/api/admin/*`. Read-only GET routes for rulebook at `/api/rulebook/*` (currently 501 stubs). Dual-database-role wiring (`DATABASE_URL` SELECT-only vs `ADMIN_DATABASE_URL` full write). PDF/document ingest service. Supersession/versioning logic.

- **Data**: Workflow A tables already defined in migration 001 but never created due to `sqlmodel.sql.sqltypes.GUID` incompatibility. No new schema fields needed — the existing model is complete.

---

## UI Design Principles (Simplified)

**One page, three tabs, zero navigation depth.** The entire admin console lives at `/admin`. No drill-down pages, no nested routes. Every action is 1-2 clicks from the tab.

```text
/admin
├── Tab 1: Sources  (list table + "Add Source" dialog)
├── Tab 2: Citations (list table filtered by selected source + "Add Citation" dialog)
└── Tab 3: Rulebook (list table with status filter + "Add Rule" dialog + inline approve/supersede)
```

### Click-minimized workflows

| Workflow | Steps | How |
| --- | --- | --- |
| Add a new standard | 2 | Tab "Sources" → "Add Source" → fill form → Submit |
| Add citations to a source | 3 | Tab "Sources" → click source row → auto-switches to "Citations" tab filtered → "Add Citation" → fill → Submit |
| Create a rule from a citation | 3 | Tab "Citations" → click citation → auto-switches to "Rulebook" tab with citation pre-linked → "Add Rule" → fill → Submit |
| Approve a rule | 1 | Tab "Rulebook" → click "Approve" button on draft row → confirm dialog |
| Supersede a rule | 2 | Tab "Rulebook" → click "Supersede" on approved row → confirm dialog |
| Upload a PDF to a source | 2 | Tab "Sources" → click "Upload" on source row → file picker → Submit |
| Check governance health | 0 | Summary bar always visible at top of `/admin` (counts of sources, citations, approved rules, pending) |

### Rejected complexity

- **No separate detail pages** — all editing happens in Dialog overlays. User never leaves `/admin`.
- **No version diff viewer** (deferred) — superseded rules are visible in the Rulebook table with a "Superseded" badge. Full diff view is a nice-to-have, not essential.
- **No multi-step wizard** for rule creation — single form with all fields. Required fields only (metric, threshold type, values, unit, context, 1 citation link, template text).
- **No separate "Governance" tab** — governance summary is a persistent top bar. Advisory warnings are inline badges on rows.

---

## 4. PR Roadmap

### PR 7.1: Database Migration Fix + Admin DB Role Wiring

- **Goal**: Fix the Alembic migration GUID type incompatibility and wire up dual-database-role access.
- **Scope (in)**:
  - Fix `sqlmodel.sql.sqltypes.GUID` import error — replace with compatible UUID column type or install correct SQLModel version.
  - Verify `alembic upgrade head` creates all tables including Workflow A tables (`reference_source`, `citation_unit`, `rulebook_entry`).
  - Wire `ADMIN_DATABASE_URL` in `backend/app/core/config.py` and `backend/app/database.py`.
  - Create a separate SQLAlchemy engine/session factory for admin writes.
  - Update `alembic.ini` to accept `DATABASE_URL` from environment variable without interpolation errors.
  - Backend health endpoint that verifies both DB roles can connect.
- **Scope (out)**: No admin UI, no CRUD routes. Infrastructure only.
- **Key Changes**: `backend/migrations/versions/001_initial_tables.py`, `backend/app/core/config.py`, `backend/app/database.py`, `backend/alembic.ini`, `backend/requirements.txt`.
- **Testing**: `alembic upgrade head` succeeds. Both `DATABASE_URL` and `ADMIN_DATABASE_URL` connect and pass read/write permissions check. Unit tests verify admin engine can INSERT into Workflow A tables while dashboard engine cannot.
- **Dependencies**: None. This must be merged first to unblock everything.

### PR 7.2: Reference Source Admin — CRUD + File Upload

- **Goal**: Admin can register, list, edit, supersede, and delete certification standard sources. Supports uploading PDF documents to `bytea` storage.
- **Scope (in)**:
  - `POST /api/admin/sources` — create a new ReferenceSource (admin engine).
  - `GET /api/admin/sources` — list all sources with filtering by status, type, jurisdiction.
  - `GET /api/admin/sources/{id}` — get a single source.
  - `PUT /api/admin/sources/{id}` — update source metadata.
  - `POST /api/admin/sources/{id}/supersede` — mark source as superseded.
  - `DELETE /api/admin/sources/{id}` — soft delete (set status to retired).
  - `POST /api/admin/sources/{id}/upload` — upload a PDF standard document, store in `bytea` column, compute checksum.
  - `GET /api/admin/sources/{id}/download` — download stored PDF.
  - Validation: required fields (title, publisher, source_type, jurisdiction, status, source_currency_status).
  - **Frontend**: `/admin` Sources tab — table list of sources with "Add Source" button (opens Dialog form). Click a source row to select it (highlighted), which auto-filters the Citations tab. Inline "Upload" and "Supersede" action buttons per row. Status shown via `SourceCurrencyBadge` (green = CURRENT_VERIFIED, amber = PARTIAL_EXTRACT, grey = SUPERSEDED).
- **Scope (out)**: No citation extraction yet. No rulebook entry creation.
- **Key Changes**: `backend/app/api/routers/admin_sources.py`, new admin router registration in `__init__.py`, Pydantic request/response schemas for sources, PDF checksum utility. `frontend/app/admin/page.tsx` — tab shell + Sources tab with table + add dialog. `frontend/components/SourceCurrencyBadge.tsx`.
- **Testing**: Unit tests for CRUD operations. Integration test: upload PDF → verify checksum stored → download returns identical bytes. Test that dashboard engine (DATABASE_URL) cannot POST to admin routes (405 or 403).
- **Dependencies**: PR 7.1 (database working).

### PR 7.3: Citation Unit Admin — Extract, Tag, Edit

- **Goal**: Admin can create citation units from a source, tag them with metrics/conditions, and mark them for review.
- **Scope (in)**:
  - `POST /api/admin/sources/{source_id}/citations` — create a CitationUnit linked to a source.
  - `GET /api/admin/sources/{source_id}/citations` — list all citations for a source.
  - `GET /api/admin/citations/{id}` — get a single citation.
  - `PUT /api/admin/citations/{id}` — edit citation fields (exact_excerpt, metric_tags, condition_tags, extracted values).
  - `DELETE /api/admin/citations/{id}` — remove a citation.
  - Validation: `exact_excerpt` required. `metric_tags` and `condition_tags` must be valid JSON arrays. `source_id` must exist.
  - **Frontend**: Citations tab — table filtered by the source selected in Sources tab. "Add Citation" dialog with fields: source (auto-filled from selection), exact_excerpt (textarea), metric_tags (multi-select chips), condition_tags (multi-select chips), extracted_threshold_value, extracted_unit. Click "Needs Review" toggle. Inline edit/delete per row.
- **Scope (out)**: No rulebook entry creation yet. No bulk import from PDF.
- **Key Changes**: `backend/app/api/routers/admin_citations.py`, Pydantic schemas for citation create/update. `frontend/app/admin/page.tsx` — Citations tab with table + add dialog. `frontend/components/MetricTagSelect.tsx` reusable chip selector.
- **Testing**: Unit tests for CRUD. Integration test: create citation without source → 400/404. Create citation with invalid metric_tags → 400. Test that a source with no citations cannot have approved rules (pre-validation for PR 7.4).
- **Dependencies**: PR 7.2.

### PR 7.4: Rulebook Entry Admin — Draft, Approve, Supersede

- **Goal**: Admin can draft rulebook entries from citations, submit for approval, and manage version lifecycle.
- **Scope (in)**:
  - `POST /api/admin/rules` — create a RulebookEntry draft. Must link to at least one `citation_unit_id`.
  - `GET /api/admin/rules` — list all rulebook entries with filters (metric_name, context_scope, approval_status, rule_version).
  - `GET /api/admin/rules/{id}` — get a single rule with its linked citation_units.
  - `PUT /api/admin/rules/{id}` — edit a draft rule. Cannot edit approved rules.
  - `POST /api/admin/rules/{id}/approve` — approve a draft (sets approval_status=approved, approved_by, approved_at).
  - `POST /api/admin/rules/{id}/supersede` — supersede an approved rule (sets approval_status=superseded, effective_to). Creates a new draft copy for re-drafting.
  - Validation guardrails:
    - Cannot approve a rule without at least one linked citation_unit.
    - Cannot approve a rule from a non-CURRENT_VERIFIED source.
    - Cannot edit an approved or superseded rule.
    - `index_weight_percent` must sum to 100% across all metrics in a given rule_version (or be advisory-only).
  - **Frontend**: Rulebook tab — table with status filter pills (All | Draft | Approved | Superseded). "Add Rule" dialog with fields: metric_name (select), threshold_type (select), min/max values, unit, context_scope (select), interpretation/business_impact/recommendation templates (textareas), citation_unit (select from Citations tab selection), index_weight_percent (number). Draft rows show "Approve" button (green). Approved rows show "Supersede" button (amber). Status shown via `StatusPill` component (grey=draft, green=approved, orange=superseded).
- **Scope (out)**: No automated threshold extraction from PDF. No rule version diff viewer.
- **Key Changes**: `backend/app/api/routers/admin_rules.py`, Pydantic schemas for rule create/update/approve. `frontend/app/admin/page.tsx` — Rulebook tab with table + add dialog + approve/supersede actions. `frontend/components/StatusPill.tsx`. Seed script `scripts/seed_rulebook_v1.py` (populates initial WHO/SS554 rules).
- **Testing**: Unit tests for all CRUD + approve + supersede. Guardrail tests: approve without citation → blocked. Approve from non-CURRENT_VERIFIED source → blocked. Edit approved rule → blocked. Integration test: supersede rule → verify effective_to set → new draft created.
- **Dependencies**: PR 7.3.

### PR 7.5: Rulebook Read-Only API + Dashboard Integration

- **Goal**: Implement the existing stubbed GET routes in `rulebook.py` so Workflow B can consume rulebook data. Connect the aggregation service to actual rulebook data.
- **Scope (in)**:
  - Implement `GET /api/rulebook/rules` — returns RulebookEntry[] with optional filters (metricName, contextScope, approvalStatus). Only returns `approved` entries.
  - Implement `GET /api/rulebook/rules/{id}` — returns a single rule with linked citation_units.
  - Implement `GET /api/rulebook/sources` — returns ReferenceSource[] with sourceCurrencyStatus.
  - Enforce read-only: PUT/POST/DELETE on rulebook routes return 405.
  - Fix the aggregation service (`backend/app/services/aggregation.py`) to use real rulebook data for wellness index calculation.
  - Update Workflow B services (parser, evaluator) to fetch `rule_version` and `citation_id` from rulebook instead of hardcoded values.
- **Scope (out)**: No admin UI changes. No new admin routes.
- **Key Changes**: `backend/app/api/routers/rulebook.py` (replace 501 stubs), `backend/app/services/aggregation.py`, `backend/app/services/rule_engine.py` (if exists).
- **Testing**: Unit tests for each GET route. Read-only enforcement test: POST to `/api/rulebook/rules` → 405. Integration test: create approved rule → GET returns it → create draft rule → GET does not return it. Wellness index calculation test: verify weights pulled from rulebook, not hardcoded.
- **Dependencies**: PR 7.4 (approved rules must exist).

### PR 7.6: Admin UI Polish + Navbar Integration

- **Goal**: Polish the admin UI, add navbar link, advisory badges, and seed initial rules.
- **Scope (in)**:
  - Add "Admin" link to top navbar ([Navbar.tsx](frontend/components/layout/Navbar.tsx)) — positioned after "Executive".
  - Advisory badges on rows: rules from non-CURRENT_VERIFIED sources get amber "Advisory" badge inline.
  - Governance summary bar at top of `/admin`: compact stat cards showing source count, citation count, approved rules count, pending drafts.
  - Responsive layout: ensure tabs collapse gracefully on smaller screens.
  - Seed script `scripts/seed_rulebook_v1.py` — pre-populates v1.0 with WHO AQG 2021 and SS554 thresholds so the system works out of the box.
- **Scope (out)**: No automated PDF parsing or AI-assisted extraction. No version diff viewer (deferred).
- **Key Changes**: `frontend/components/layout/Navbar.tsx` — add Admin link. `frontend/app/admin/page.tsx` — governance summary bar. `scripts/seed_rulebook_v1.py`.
- **Testing**: Verify navbar link navigates to `/admin`. Test advisory badges render on non-CURRENT_VERIFIED rows. Run seed script → verify all tabs populate with data. Test responsive layout at 768px breakpoint.
- **Dependencies**: PR 7.5 (rulebook API returning data).

---

## 5. Milestones & Sequence

```
PR 7.1 (DB fix + admin role)
  → PR 7.2 (Source CRUD + upload)
    → PR 7.3 (Citation editor)
      → PR 7.4 (Rulebook draft/approve/supersede)
        → PR 7.5 (Read-only API + dashboard integration)
          → PR 7.6 (Admin UI polish + navbar + seed script)
```

**Critical path**: PR 7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 (sequential — each PR depends on the previous).

**Parallel opportunity**: PR 7.6 (frontend) can begin while PR 7.5 backend is being finalized, using mock data for the admin UI components.

**Unblock priority**: PR 7.1 must be merged before any other PR can be tested end-to-end. Without it, all database operations fail.

---

## 6. Risks, Trade-offs, and Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **R1: SQLModel GUID compatibility** | Blocks all database access | PR 7.1 addresses this directly. Alternative: use `sa.Column(sa.Uuid(), ...)` in Alembic if SQLModel GUID isn't available in installed version. |
| **R2: Admin security in Phase 1/2** | No auth = anyone with laptop access can modify rules | Acceptable for Phase 1/2 (internal laptop only). Document that admin routes are unprotected. Phase 3 must add Clerk auth + role-based access for admin. |
| **R3: Manual data entry burden** | Admins must manually type exact_excerpt, thresholds, templates from PDF standards | Acceptable for MVP. Future enhancement: AI-assisted PDF parsing to auto-extract citations. |
| **R4: Rule version weight validation** | index_weight_percent may not sum to 100% across metrics | Add validation in PR 7.4 approve endpoint. Warn (not block) if weights are incomplete — allow partial-weight advisory rules. |
| **R5: Supersession cascade** | Superseding a rule may invalidate existing findings that reference it | Document that findings are immutable and reference the rule_version at time of evaluation. Superseding creates new versions; old findings remain valid for their context. |

### Trade-offs

| Decision | Rationale |
|----------|-----------|
| **bytea storage for PDFs** vs Supabase Storage | Lean MVP approach. Matches existing TDD decision. Can migrate to Supabase Storage later if file sizes grow. |
| **Manual citation entry** vs automated PDF parsing | Automated extraction is complex (layout parsing, OCR, NLP). Manual entry ensures accuracy for the initial rulebook. Can add AI assist in a future PR. |
| **Admin routes in same FastAPI app** vs separate service | Simpler deployment, same codebase. Security boundary is the `ADMIN_DATABASE_URL` role separation, not network isolation. Adequate for Phase 1/2. |
| **No approval workflow UI** (single-click approve) vs multi-step review | The PSD names Jay Choy as sole approval authority. Single-click approve with email/name capture is sufficient. Multi-step workflow can be added if team grows. |

### Open Questions

1. **Q1: Seed script scope** — The seed script (`scripts/seed_rulebook_v1.py`) is planned for PR 7.6. Should it include WHO AQG 2021 + SS554 as default, or leave it minimal (1-2 entries) for testing only? Recommendation: include both standards fully — it saves manual setup and serves as the initial rulebook.

2. **Q2: How should rule versions be numbered?** — Current schema uses `rule_version: str`. Should this follow semver (`1.0.0`, `1.1.0`, `2.0.0`) or simple increments (`v1`, `v2`)? Recommendation: simple `v1`, `v2` for now — the TDD uses `v1.0` format.

3. **Q3: Should superseded rules be visible in the read-only API?** — Currently `GET /api/rulebook/rules` only returns `approved` entries. Should it also return superseded entries (for audit/history)? Recommendation: add `?include_superseded=true` query param to the GET endpoint.

4. **Q4: What happens when a source is superseded?** — Should all its citations and rules be automatically marked as superseded, or should the admin handle this manually? Recommendation: supersede source → prompt admin to review linked rules. Don't auto-supersede rules — they may still be valid under other sources.
