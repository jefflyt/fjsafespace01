# PR Plan: PR-R1-05 — Frontend Refactor (Human-Friendly Dashboard)

## 0) Pre-Flight Roadmap Check

Before starting this PR, read `docs/plans/epics/R1-Refactor/ROADMAP.md` to confirm:

- **Dependencies**: PR-R1-05 depends on PR-R1-04 — APIs must exist
- **Scope boundaries**: Scope (in) = 6 new components, refactored /ops and /executive pages, UploadForm update.
  Scope (out) = PDF UI (R3), real-time charts (R2)
- **Risks**: Review risk #4 (frontend refactor too large for single PR) — can split into components-first +
pages-refactor if needed
- **Status**: Verify PR-R1-04 is merged, all API endpoints return expected data

**Post-Completion Check**: After merging, re-read ROADMAP.md to verify:

- All scope (in) items are delivered, scope (out) items are untouched
- Next PR (PR-R1-06) dependency is satisfied: all components exist for testing
- Test responsive layout down to 375px width

## 1) Assumptions

- All backend APIs from PR-R1-04 are functional and documented.
- Existing frontend components: UploadForm, WellnessIndexCard, CrossSiteComparisonTable, TimeSeriesChart, Navbar,
Sidebar.
- Existing pages: `/ops` (operations), `/executive` (executive view).
- `/ops` Findings tab currently shows placeholder "under construction" message.
- Shadcn UI components available: card, badge, select, button, dialog, input, table.
- Recharts available for charts. TimeSeriesChart component already supports threshold bands.
- AuthProvider from PR-R1-01 wraps layout.

## 1) Feature Summary

- **Goal**: Replace compliance findings panel with human-friendly metric cards, site overview, zone detail, standard
selector, metric selector
- **User Story**: As a facility manager, I want to see my site's health in plain language with colour-coded urgency so
that I can quickly identify what needs attention and what to do about it.
- **Acceptance Criteria**:
  1. Upload form includes standard selector (multi-select, SS554 default)
  2. After upload, dashboard shows site overview card with per-standard wellness scores
  3. Zone detail shows metric cards with interpretation text and recommended actions
  4. Standard selector switches evaluation view between active standards
  5. Metric selector persists preferences per-site via API
  6. Threshold config dialog validates against rulebook bounds
  7. Executive dashboard shows per-standard badges on leaderboard
  8. Dashboard is responsive down to 375px width
  9. Colour coding: green (healthy), yellow (attention), red (action required)
- **Non-goals**: PDF generation (R3), real-time charts (R2), mobile app

## 2) Approach Overview

- **Proposed UX**: Site overview cards with wellness badges, zone detail with metric cards showing value +
interpretation + action. Standard selector tabs, metric selector checkboxes.
- **Proposed Frontend**: New components (SiteOverviewCard, MetricCard, StandardSelector, MetricSelector,
ThresholdConfigDialog, ZoneDetailView). Refactored /ops and /executive pages.
- **Proposed API**: No backend changes — all APIs implemented in PR-R1-04.

## 3) PR Plan

### PR Title: `feat(R1-05): frontend refactor to human-friendly dashboard`

### Branch Name: `r1-05-frontend-refactor`

### Key Changes by Layer

**Frontend:**

1. **SiteOverviewCard** (`frontend/components/SiteOverviewCard.tsx` — new)
   - Displays: site name, last updated timestamp, scan mode indicator ("Last uploaded X ago" or "Live — connected")
   - Active standards section: each standard shows wellness score (0-100) + pass/fail badge
   - Overall wellness rating: colour-coded (green/yellow/red based on worst standard outcome)
   - Top insight: single most important finding (e.g., "CO₂ elevated in Meeting Room A")
   - Uses Shadcn Card component

2. **MetricCard** (`frontend/components/MetricCard.tsx` — new)
   - Displays: metric value + unit, colour-coded status badge per standard
   - Human-readable interpretation text
   - Recommended action text
   - Uses Shadcn Card, Badge components
   - Colour mapping: GOOD=green, WATCH=yellow, CRITICAL=red

3. **StandardSelector** (`frontend/components/StandardSelector.tsx` — new)
   - Tab or dropdown to switch between active standards
   - Only shows standards that are active for the current site (from site_standards API)
   - Uses Shadcn Select or Tabs component

4. **MetricSelector** (`frontend/components/MetricSelector.tsx` — new)
   - Checkbox list of available metrics (from MetricName enum)
   - Checked = visible on dashboard, unchecked = hidden
   - Persists selection via PATCH /api/sites/{id}/metric-preferences
   - Uses Shadcn Checkbox component

5. **ThresholdConfigDialog** (`frontend/components/ThresholdConfigDialog.tsx` — new)
   - Modal dialog to adjust alert thresholds per metric
   - Shows rulebook min/max bounds as "safe range"
   - Input fields for watch_max, watch_min, critical_max, critical_min
   - Validates against rulebook bounds on save
   - Uses Shadcn Dialog component

6. **ZoneDetailView** (`frontend/components/ZoneDetailView.tsx` — new)
   - Aggregates MetricCards for a zone
   - Includes StandardSelector to switch between standards
   - Includes MetricSelector to filter visible metrics
   - Includes ThresholdConfigDialog button
   - Includes TimeSeriesChart for trend visualization (reused)

7. **UploadForm refactor** (`frontend/components/UploadForm.tsx`)
   - Add standard selector (multi-select, fetches from GET /api/rulebook/sources, SS554 default)
   - Remove PR9 customer info fields (clientName, siteAddress, premisesType, contactPerson) — handled by Supabase Auth
   - Keep file upload, validation, submission logic

8. **WellnessIndexCard refactor** (`frontend/components/WellnessIndexCard.tsx`)
   - Update to show per-standard scores instead of single score
   - Each standard: score (0-100) + badge (Certified/Not Certified/Coming Soon)
   - Keep existing visual style

9. **CrossSiteComparisonTable refactor** (`frontend/components/CrossSiteComparisonTable.tsx`)
   - Add per-standard score columns
   - Add filter by standard
   - Admin-only view (hide for facility managers per D-R1-04)

10. **Operations page refactor** (`frontend/app/ops/page.tsx`)
    - Upload tab: uses refactored UploadForm with standard selector
    - Findings tab: replaced with SiteOverviewCard + ZoneDetailView layout
    - Reports tab: keep placeholder "planned for R3"

11. **Executive page refactor** (`frontend/app/executive/page.tsx`)
    - Portfolio view showing all sites with per-standard badges
    - Filter by standard, by scan mode (admin-only)
    - Filter to show only sites needing attention

12. **API client** (`frontend/lib/api.ts`)
    - Add typed functions for all new endpoints (if not done in PR-R1-04)

**Backend:**

- No backend changes

### Edge Cases to Handle

- No standards active for site → show "No standards configured" message
- No data for site → show "No scan data. Upload a CSV to get started."
- Metric with no interpretation text → show generic "No interpretation available"
- Upload with standards that include SafeSpace placeholder → show "Coming Soon" badge
- Mobile viewport (375px) → cards stack vertically, selectors become dropdowns
- Invalid threshold override → show validation error in dialog

## 4) Testing & Verification

### Automated Tests

- Vitest: SiteOverviewCard renders per-standard scores correctly
- Vitest: MetricCard shows correct colour for threshold_band
- Vitest: StandardSelector switches between standards
- Vitest: MetricSelector persists preferences via API

### Manual Verification Checklist

1. Upload CSV with SS554 selected → dashboard shows site overview with SS554 score
2. Switch standard to WELL → score updates
3. Click zone → metric cards show with interpretation text
4. Toggle metric off → card disappears, preference saved
5. Open threshold config → adjust value → save → validation works
6. Executive page → shows all sites with per-standard badges
7. Resize browser to 375px → layout stacks, all content accessible
8. No regression on existing upload flow

### Commands to Run

```bash
cd frontend && pnpm dev
cd frontend && pnpm test
```

## 5) Rollback Plan

1. Revert `frontend/app/ops/page.tsx` and `frontend/app/executive/page.tsx` to originals
2. Remove new component files (SiteOverviewCard, MetricCard, StandardSelector, MetricSelector, ThresholdConfigDialog,
ZoneDetailView)
3. Revert UploadForm.tsx and WellnessIndexCard.tsx to originals
4. Revert CrossSiteComparisonTable.tsx
5. Note: No backend changes to revert

## 6) Follow-ups

- PDF report UI (R3)
- Real-time chart streaming (R2)
- Email alert preferences UI (R2)
- Mobile-specific optimizations beyond responsive layout
