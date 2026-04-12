# Epic Plan: PR6 - Executive Dashboard & Aggregation (Phase 2)

## 1. Feature/Epic Summary
- **Objective**: Build the Phase 2 Executive View, creating a high-level dashboard that pulls aggregated data across sites. This epic introduces the backend Dashboard Aggregation Service, the cross-site leaderboard sorted by the Wellness Index, and summary panels (Top Risks, Top Actions).
- **User Impact**: FJ Executives gain a portfolio-level perspective of all managed sites. They can instantly see which building is failing safety standards, view the dynamically weighted Wellness Index, and comprehend risks within 5 minutes (per the PSD NFR-D10).
- **Dependencies**: Phase 1 (PR 1 - PR 5). The aggregation relies on the `Report` and `Finding` models being populated.
- **Assumptions**: 
  - Executive views aggregate all data globally (strict tenant isolation is deferred to Phase 3).
  - The "Wellness Index" score requires cross-referencing findings with weights embedded in the Rulebook APIs.

## 2. Complexity & Fit
- **Classification**: Multi-PR
- **Rationale**: Implementing complex mathematical aggregation for the Wellness Index, building optimized database queries to fetch cross-site Leaderboards, and constructing a brand new layout for the Executive UI requires splitting the backend logic from frontend representation.
- **Estimated PRs**: 3

## 3. Full-Stack Impact
- **Frontend**: A new route group (`/executive/*`). Layouts, global site multi-selectors, date range pickers, and visual cards (Leaderboard, Top Risks).
- **Backend**: `Dashboard Aggregation Service` module. Complex SQL queries or views grouping findings by site and applying index weights. `GET /api/dashboard/executive`.
- **Data**: Optimization indexes on `Finding` and `Report` tables for faster aggregate querying.
- **Infra/Config**: None specifically.

## 4. PR Roadmap

### PR 6.1: Aggregation Models & Database Optimization
- **Goal**: Support high-performance, aggregated queries summarizing metrics across all sites.
- **Scope (in)**: Adding indexes to the database (e.g., on `site_name`, `created_at`, `rule_version`). Building the `Dashboard Aggregation Service` module in FastAPI with methods to calculate the `wellness_index_score` and list `top_3_risks`.
- **Scope (out)**: FastAPI router endpoints, Frontend UI.
- **Key Changes**: `backend/app/services/aggregation.py`, `backend/alembic/versions/` (for adding db indexes).
- **Testing**: Write unit tests proving the math for the `wellness_index_score` matches the FJ SafeSpace Benchmark formulas exactly.
- **Verification**: Run `pytest` and verify the math equations return the correct color-coding bounds (e.g., >= 90% is Green).
- **Rollback Plan**: Revert service module and drop indexes.
- **Dependencies**: Phase 1 fully complete.

### PR 6.2: Executive Dashboard REST APIs
- **Goal**: Expose the aggregated dashboard data to the frontend via efficient endpoints.
- **Scope (in)**: Define Pydantic models for Dashboard Cards (`LeaderboardRow`, `TopRisk`, `SpaceHealthRating`). Create `GET /api/dashboard/executive` resolving all required data for the view.
- **Scope (out)**: UI implementations.
- **Key Changes**: `backend/app/routers/dashboard.py`, `backend/app/schemas/dashboard.py`.
- **Testing**: Test endpoint latency; ensure it returns under a predetermined threshold (supporting the <3s total page load NFR).
- **Verification**: Call the endpoint using tools like `curl` and inspect the JSON shape against the PSD requirements.
- **Rollback Plan**: Revert router additions.
- **Dependencies**: PR 6.1.

### PR 6.3: Executive UI & Leaderboard Views
- **Goal**: Build the Phase 2 Executive User Interface.
- **Scope (in)**: `frontend/app/executive/page.tsx`. Implement the Page Header (site multi-select, date picker). Implement the Wellness Index cards (using color-coding from PSD: Green, Amber, Red, Grey for Insufficient Evidence). Build the Top 3 Risks panel.
- **Scope (out)**: Zone/Floor drill-down views (could be pushed to a subsequent epic).
- **Key Changes**: `frontend/app/executive/layout.tsx`, `frontend/components/LeaderboardTable.tsx`, `frontend/components/RiskCard.tsx`.
- **Testing**: Verify rendering handles empty states robustly ("No findings available — upload required").
- **Verification**: Load the `/executive` UI in a browser against seeded, mocked data and verify UI responsiveness and color accuracy.
- **Rollback Plan**: Revert frontend component changes.
- **Dependencies**: PR 6.2.

## 5. Milestones & Sequence
- **Milestone 1**: Aggregation Math Engine Active (PR 6.1 & PR 6.2). We can programmatically calculate health indexes for an entire building portfolio.
- **Milestone 2**: Executive View Go-Live (PR 6.3). The layout passes the "Stakeholder 5-minute comprehension test" (QA AC-D7).

## 6. Risks, Trade-offs, and Open Questions
- **Major Risks**: 
  - Iterating through potentially thousands of findings to calculate a global Wellness Index dynamically could cause the API to timeout or bog down the database.
  - *Mitigation*: We may need to cache the Wellness Index at the `Report` level, rather than doing live calculation on every dashboard load.
- **Trade-offs**: 
  - To support the < 3 second page load NFR, we might heavily denormalize some `top_risk` tracking upon finding insertion, trading slightly slower upload parsing for blazing fast Executive Dashboard reads.
- **Open Questions**: How exactly are multiple sites filtered? (Is it a dropdown, checkboxes, or a completely separate route?) PSD mentions "multi-select + date range picker".
