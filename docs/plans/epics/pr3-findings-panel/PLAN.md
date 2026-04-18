# Epic Plan: PR3 - Findings Panel & Rule Evaluation

> **STATUS**: ✅ **COMPLETED** (18 April 2026)
>
> All three sub-PRs have been fully implemented and verified in the codebase.
>
> - PR 3.1: Finding Data Models & Core Rule Evaluator API ✅
> - PR 3.2: FastAPI Findings Endpoints ✅
> - PR 3.3: Findings Panel UI & Interactive Citation Badges ✅

## 1. Feature/Epic Summary

- **Objective**: Synthesize raw scanned data into
  rule-evaluated Findings with strict traceability
  (`rule_version`, `citation_id`). Render these Findings
  in the Analyst Dashboard utilizing interactive citation
  badges.
- **User Impact**: Analysts can view processed findings,
  quickly understand IAQ metric performance against
  thresholds, and trace the source of truth back to
  specific regulations or standards.
- **Dependencies**: PR2 (Upload pipeline must exist to
  ingest data, or the findings logic must simulate it).
- **Assumptions**:
  - Standard/Rulebook data is available (even mocked) to
    enforce `rule_version` and `citation_id`.
  - The dashboard is read-only for rules; it doesn't edit
    the Rulebook itself.

## 2. Complexity & Fit

- **Classification**: Multi-PR.
- **Rationale**: Implementing the DB models for strict
  rule evaluation, mapping logic in FastAPI, and
  constructing a detailed UI with intricate error
  handling (Insufficient Evidence, advisory warnings) is
  complex. Separating DB/Logic from API, and API from UI
  reduces PR review burden and aligns with the PSD QA
  gates.
- **Estimated PRs**: 3

## 3. Full-Stack Impact

- **Frontend**: `FindingsPanel.tsx` table component
  mapping metrics to values, units, and bands.
  `CitationBadge` popover component exposing rule IDs.
- **Backend**: Rule Evaluation service module. FastAPI
  route for `GET /api/uploads/{upload_id}/findings`.
- **Data**: `Finding` SQLModel linked to an Upload/Scan
  record, containing threshold bands, value, unit,
  `rule_version`, `citation_id`, and
  `source_currency_status`.
- **Infra/Config**: Relying on current DB setup.

## 4. PR Roadmap

### PR 3.1: Finding Data Models & Core Rule Evaluator API

- **Goal**: Define the exact backend contract for a
  'Finding' with its mandatory traceability properties.
- **Scope (in)**: SQLModel `Finding`, Alembic migrations.
  A robust Service module that enforces the PSD
  constraint: Every finding must include `rule_version` +
  `citation_id` or default to Insufficient Evidence.
- **Scope (out)**: FastAPI router endpoints responding to
  clients, Frontend UI.
- **Key Changes**: `backend/app/models/findings.py`,
  `backend/alembic/versions/`,
  `backend/app/services/rule_evaluator.py`.
- **Testing**: Unit tests that ensure an exception is NOT
  thrown, but `certification_outcome` or `Insufficient
  Evidence` is marked if citations are missing.
- **Verification**: Run `pytest` on the evaluation module
  ensuring strict QA-G5 compliance.
- **Rollback Plan**: Revert schema and downgrade Alembic.
- **Dependencies**: PR 2.1 (Needs the Upload model).

### PR 3.2: FastAPI Findings Endpoints

- **Goal**: Expose the evaluated findings to the
  dashboard layer and hook it into the upload
  synchronous pipeline.
- **Scope (in)**: `GET /api/uploads/{id}/findings`.
  Linking PR 3.1's evaluator inside PR 2.2's parser flow
  (so when a file finishes parsing, findings are
  generated automatically). Pydantic response schemas.
- **Scope (out)**: UI implementations.
- **Key Changes**: `backend/app/routers/findings.py`,
  `backend/app/schemas/findings.py`,
  `backend/app/routers/upload.py` (wiring).
- **Testing**: Test the endpoints to ensure 500s are
  avoided when rule context is missing, evaluating proper
  failure states gracefully.
- **Verification**: Call the endpoint via URL with a mock
  ID; map the Pydantic shapes against the PSD data
  contract.
- **Rollback Plan**: Revert router changes.
- **Dependencies**: PR 3.1 & PR 2.2.

### PR 3.3: Findings Panel UI & Interactive Citation Badges

- **Goal**: Render the findings interactively on the
  frontend for analysts.
- **Scope (in)**: Findings table grouping by zone/metric.
  Clickable Citation Badges using Popovers (Shadcn).
  Warning chips for non-current sources (`Partial
  Extract`).
- **Scope (out)**: The Report Draft form and UI
  (Reserved for PR4).
- **Key Changes**: `frontend/components/FindingsPanel.tsx`,
  `frontend/components/CitationBadge.tsx`.
- **Testing**: Visual checks on various states: Perfect
  finding, Advisory label finding, Missing rule finding.
- **Verification**: View the panel in the browser, click
  badges to see source title, version, and currency
  status appear in the popover.
- **Rollback Plan**: Revert frontend component additions.
- **Dependencies**: PR 3.2, PR 1.1.

## 5. Milestones & Sequence

- **Milestone 1**: Traceable Findings Backend
  (PR 3.1 & PR 3.2). The backend reliably evaluates
  rules synchronously and returns formatted REST payloads.
- **Milestone 2**: Actionable UI (PR 3.3). Operators
  can scrutinize finding citations, satisfying the core
  transparency value-prop.

## 6. Risks, Trade-offs, and Open Questions

- **Major Risks**:
  - Mocking the Rulebook locally (before the real
    centralized DB is live) might introduce logic drift.
  - Doing rule evaluation synchronously via FastAPI
    within the file upload request could drastically
    limit file-size tolerances.
- **Trade-offs**:
  - Constructing evaluation logic separated from a real
    DB Rulebook sacrifices 'full accuracy' right now for
    speed of unblocking the UI team.
- **Open Questions**: In the Analyst UI, do findings
  stream in as they parse, or does the component only
  load once the entire file resolves? (Assuming blocking
  100% completion before rendering).
