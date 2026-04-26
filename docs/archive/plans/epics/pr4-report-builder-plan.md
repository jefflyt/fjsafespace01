# Epic Plan: PR4 - Report Draft Builder & QA Checklist

> **STATUS**: ✅ **COMPLETED** (18 April 2026)
>
> All three sub-PRs have been fully implemented and
> verified in the codebase.
>
> - PR 4.1: Report Data Model & QA Gate Service ✅
> - PR 4.2: FastAPI Report Endpoints ✅
> - PR 4.3: Frontend Report Draft Builder & Checklist UI ✅

## 1. Feature/Epic Summary

- **Objective**: Create the Report Draft module allowing
  analysts to bundle approved findings into formal
  reports (Assessment or Intervention Impact). This
  includes enforcing the stringent QA Gates (QA-G1 to
  QA-G8) before any report can be approved for PDF
  generation.
- **User Impact**: Analysts gain a structured, guided
  pathway to certify data quality, verify disclaimers,
  and capture mandatory signatures (like Jay Choy) prior
  to releasing official FJ SafeSpace documents.
- **Dependencies**: PR3 (Findings must exist before a
  report draft can be assembled).
- **Assumptions**:
  - Auth is mocked for Phase 1/2, so the "Jay Choy"
    approval will be simulated via a hardcoded user
    selector or payload flag.
  - QA checks are partially automated (e.g., checking if
    `citation_id` exists) and partially manual (e.g.,
    reviewing the disclaimer text).

## 2. Complexity & Fit

- **Classification**: Multi-PR
- **Rationale**: Implementing the Report lifecycle state
  machine (`draft_generated` -> `in_review` ->
  `approved`), the specific QA validation logic across 8
  different gates, and the complex frontend forms
  involves significant state management. Splitting the
  database/backend validation from the UI implementation
  isolates business logic from representation.
- **Estimated PRs**: 3

## 3. Full-Stack Impact

- **Frontend**: Report creation form
  (`/analyst/reports/new`). QA Checklist interactive
  component preventing early submission. Report Draft
  detail page.
- **Backend**: `Report` SQLModel. `qa_gates.py` service.
  FastAPI routers for initiating a draft and attempting
  an approval transition.
- **Data**: New `Report` table containing `type`
  (`ASSESSMENT` | `INTERVENTION_IMPACT`), `status`,
  `reviewer_name`, list of `qa_checks` booleans.
- **Infra/Config**: None.

## 4. PR Roadmap

### PR 4.1: Report Data Model & QA Gate Service

- **Goal**: Establish the DB schema for Reports and the
  backend engine evaluating the QA Gates.
- **Scope (in)**: SQLModel `Report`, Alembic migration
  script. `backend/app/services/qa_gates.py` which takes
  a Draft Report and its Findings to assert QA-G1 to
  QA-G8.
- **Scope (out)**: FastAPI API endpoints, Frontend UI.
- **Key Changes**: `backend/app/models/report.py`,
  `backend/app/services/qa_gates.py`,
  `backend/alembic/versions/`.
- **Testing**: Unit tests passing mocked Report payloads
  into the QA Gate Service to verify failures (e.g.,
  failing QA-G8 if the reviewer isn't Jay Choy).
- **Verification**: Run `pytest` on the QA gates logic.
- **Rollback Plan**: Revert schema and downgrade Alembic.
- **Dependencies**: PR 3.1 (Needs the `Finding` model
  to link).

### PR 4.2: FastAPI Report Endpoints

- **Goal**: Expose the Report Draft operations over REST.
- **Scope (in)**: `POST /api/reports` (initiate draft).
  `PATCH /api/reports/{id}/qa-checklist` (save progress).
  `POST /api/reports/{id}/approve` (run QA Gates
  service, transition status).
- **Scope (out)**: UI implementations.
- **Key Changes**: `backend/app/routers/reports.py`,
  `backend/app/schemas/report.py`.
- **Testing**: E2E API tests ensuring that attempting to
  approve a report with incomplete QA steps throws a
  `400 Bad Request` or specific validation error.
- **Verification**: Use REST client to manually step
  through: create draft -> update checks -> fail
  approval -> fix checks -> pass approval.
- **Rollback Plan**: Revert router changes.
- **Dependencies**: PR 4.1.

### PR 4.3: Frontend Report Draft Builder & Checklist UI

- **Goal**: Build the Analyst UI to wrap findings into
  a Report and interactively check off the QA gates.
- **Scope (in)**: `/analyst/reports/new` creation page
  with Report Type selector (Assessment vs Intervention
  Impact). `/analyst/reports/{id}` detail page with the
  interactive QA Checklist. The "Approve & Generate"
  button logic.
- **Scope (out)**: The actual PDF generation itself
  (Reserved for PR5).
- **Key Changes**: `frontend/app/analyst/reports/[id]/page.tsx`,
  `frontend/components/QAChecklist.tsx`,
  `frontend/components/ReportTypeBadge.tsx`.
- **Testing**: Visual validation of the disabled
  "Approve" button when checklist items are false.
- **Verification**: Attempt to create a report via the
  UI, verify the Type is persisted, check off the boxes,
  simulate Jay Choy review, and click Approve.
- **Rollback Plan**: Revert frontend component additions.
- **Dependencies**: PR 4.2, PR 3.3.

## 5. Milestones & Sequence

- **Milestone 1**: Robust Gatekeeping Backend
  (PR 4.1 & PR 4.2). The API actively defends against
  sub-par reports being approved.
- **Milestone 2**: Guided Analyst Workflow (PR 4.3).
  Analysts have a transparent checklist to follow, easing
  cognitive load and ensuring 100% compliance.

## 6. Risks, Trade-offs, and Open Questions

- **Major Risks**:
  - Mocking the final reviewer authorization
    (`Jay Choy only`) in Phase 1 (where auth isn't
    natively built-in yet) might lead to trivial bypasses
    if not clearly documented as a placeholder.
- **Trade-offs**:
  - Building a manual checklist UI for things the backend
    could auto-calculate (like 'are all citations
    present') forces the human in the loop. We trade
    ultimate speed for absolute Analyst accountability,
    aligning with the FJ SafeSpace ethos.
- **Open Questions**: Once a report is "Approved", is it
  completely immutable? If a typo is found later, do we
  revise the existing report or issue a new Upload/Draft
  entirely? (PSD implies strict immutability, requiring
  a new version bumped report).
