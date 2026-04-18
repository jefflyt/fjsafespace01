# Epic Plan: PR1 - Common Components & Layout Skeleton

> **STATUS**: ✅ **COMPLETED** (17 April 2026)
>
> Both PR 1.1 and PR 1.2 have been fully implemented
> and verified in the codebase.
>
> - PR 1.1: UI Library & Theme Configuration ✅
> - PR 1.2: Analyst Layout & Navigation Skeleton ✅

## 1. Feature/Epic Summary

- **Objective**: Establish the base frontend foundation
  for the Phase 1 Analyst/Operations View, including
  styling frameworks, component libraries, and global
  layout structures.
- **User Impact**: Provides the structural shell (Navbar,
  sidebars, main content areas) necessary for operators
  to navigate between Upload, Findings, and Report
  features. Sets the standard for visual consistency.
- **Dependencies**: Existing `frontend` Next.js bootstrap.
- **Assumptions**:
  - Using Next.js 15 App router.
  - Using Tailwind CSS and `shadcn/ui` for components.
  - The backend endpoints are not necessary for this
    layout shell to compile and render.

## 2. Complexity & Fit

- **Classification**: Multi-PR (or technically one large
  Feature PR)
- **Rationale**: While this is designated as "PR1" in
  the Master Plan, bootstrapping a component library
  (`shadcn`), configuring themes, creating global
  application layouts, and building placeholder pages
  is safer when split into two distinct, reviewable PRs
  to separate configuration from UI implementation.
- **Estimated PRs**: 2
- *(Note: If you prefer to implement this in a single
  burst, you can treat this entire epic as one feature
  using the `/plan_feature` or `/implement_task`
  workflows directly.)*

## 3. Full-Stack Impact

- **Frontend**:
  - Configuration of Tailwind and Shadcn CLI.
  - Global `layout.tsx`, navigation bars, sidebar
    components.
  - Placeholders for `/analyst`, `/analyst/upload`,
    `/analyst/findings`, `/analyst/reports`.
- **Backend**: None.
- **Data**: None.
- **Infra/Config**: `components.json` for shadcn,
  `tailwind.config.ts`, global CSS styles.

## 4. PR Roadmap

### PR 1.1: UI Library & Theme Configuration

- **Goal**: Initialize styling and component library
  dependencies to set a common design language.
- **Scope (in)**: Initialize `shadcn/ui`, construct the
  CSS variable theme, and add fundamental atomic
  components (Button, Card, Table, Badge, Inputs).
- **Scope (out)**: No page layouts or application routing.
- **Key Changes**:
  - Add `components.json` via shadcn cli.
  - Modify `globals.css` and `tailwind.config.ts` for
    FJDashboard theme colors.
  - Install `lucide-react`.
  - Add primitive components to `frontend/components/ui/`.
- **Testing**: Ensure Tailwind compiles successfully and
  basic components import without errors.
- **Verification**: Run `pnpm dev` and ensure the default
  page still loads with updated global styles.
- **Rollback Plan**: Revert configuration files and delete
  `components/ui`.
- **Dependencies**: None.

### PR 1.2: Analyst Layout & Navigation Skeleton

- **Goal**: Build the structural framing for the Phase 1
  web app.
- **Scope (in)**: Main Navbar, side nav/tabs for the
  Analyst workspace, layout wrapper, and placeholder
  Next.js page routes.
- **Scope (out)**: Actual data fetching and the functional
  upload queue or findings tables.
- **Key Changes**:
  - `frontend/app/layout.tsx` (Global app framing).
  - `frontend/app/analyst/layout.tsx` (Analyst specific
    sidebar/tabs).
  - Placeholder pages mapping out the routes: `/analyst`,
    `/analyst/upload`, `/analyst/reports`.
  - `frontend/components/layout/Navbar.tsx` and
    `Sidebar.tsx`.
- **Testing**: Visual check of layout routing and mobile
  responsiveness. Active link states should work.
- **Verification**: Navigate through the placeholder
  routes in the browser; ensure the UI frame persists and
  correctly highlights active routes.
- **Rollback Plan**: Revert route additions in
  `frontend/app/analyst`.
- **Dependencies**: PR 1.1 (Requires basic UI components
  like Buttons or Cards).

## 5. Milestones & Sequence

- **Milestone 1**: UI Primitives Ready - Once PR 1.1 is
  merged, the team has a standard set of buttons, inputs,
  and cards to build features rapidly.
- **Milestone 2**: Analyst Shell Complete - Once PR 1.2 is
  merged, developers can parallelize work on Upload,
  Findings, and Reports as the routes and layout structure
  exist.

## 6. Risks, Trade-offs, and Open Questions

- **Major Risks**: Conflicting CSS rules or Next.js layout
  composition issues causing unexpected re-renders.
- **Trade-offs**: Decided to use `shadcn/ui` instead of
  writing components from scratch, trading off slightly
  more boilerplate code in our repo for significantly
  faster development time.
- **Open Questions**: Are there any particular brand colors
  or primary accent colors required for the FJDashboard
  theme beyond standard internal tooling palettes?
