# MASTER PLAN: FJDashboard

> Updated 2026-04-19. Reflects PR1–PR8 completion and architecture simplification.

## 1. Product Summary

- **Problem Statement**: FJ SafeSpace needs an operational and reporting interface to convert approved, rule-based findings into role-appropriate, traceable, and actionable views for internal operators and executives, without manually overriding thresholds.
- **Target Users**: Internal Analysts/Operators, FJ Executives, and (in Phase 3) Customer Tenants.
- **Value Proposition**: A single source of truth for IAQ reports (Assessment & Intervention Impact) with high traceability, ensuring certification integrity and providing actionable, dynamically-weighted wellness insights via role-gated views.
- **Core Features**:
  - Traceable, read-only consumption of Rulebook findings.
  - Role-gated views (Operations upload/findings/reports, Executive dashboard).
  - Two report types auto-detected from data (Assessment vs Intervention Impact).
  - Strict QA gates enforcing non-obvious citations, data quality, and auth for certifications.
  - Immutable PDF generation — rendered HTML stored at approval time, PDFs generated on-demand.

## 2. Goals, Success Criteria, and Constraints

- **Product Goals**: Provide a robust, synchronous pipeline from scan upload to printable PDF/dashboard view, ensuring IAQ ratings are transparent, fully cited, and trustworthy.
- **Success Criteria**:
  - Analyst view loads in < 3s, Report drafts generation < 2m.
  - 100% of certification-impact findings display `rule_version` and `citation_id`.
  - Executive view comprehension confirmed within 5 minutes.
  - Strict compliance with the 9 QA compliance gates (QA-G1 to QA-G9).
  - Phase 3 tenant isolation passes penetration test.
- **Constraints & Assumptions**:
  - No finding generation or manual thresholding in the dashboard (read-only from Rulebook DB).
  - Synchronous PDF generation using WeasyPrint.
  - Auth is bypassed for Phase 1/2 (internal laptop only), but enforced via Clerk for Phase 3.
  - Supabase Storage for raw CSV uploads only. PDFs stored as immutable HTML snapshots in PostgreSQL.
  - Supabase Postgres for production database, Docker Compose PostgreSQL for local development.

## 3. Architecture & Technology Stack

### 3.1 Frontend

- **Framework**: Next.js 15 (App Router, TS), Tailwind CSS, Shadcn UI.
- **Data Fetching**: Centralized `fetch` client to FastAPI (`frontend/lib/api.ts`).

### 3.2 Backend

- **Framework**: Python 3.12+ FastAPI.
- **ORM & DB interaction**: SQLModel with SQLAlchemy, Alembic for migrations.
- **Document Rendering**: WeasyPrint for synchronous HTML-to-PDF generation.

### 3.3 Data

- **Database**: PostgreSQL. Production: Supabase (`jertvmbhgehajcrfifwl`). Dev: Docker Compose.
- **File Storage**: Supabase Storage (`iaq-scans` bucket) — raw CSV uploads only.
- **Schema**: 11 tables across Workflow A (3), Supporting (2), Workflow B (5), Legacy (1). Full reference: [`docs/SCHEMA_REFERENCE.md`](./SCHEMA_REFERENCE.md).

### 3.4 Auth & Security

- **Phase 1 & Phase 2**: No authentication (internal execution only).
- **Phase 3**: Clerk for Tenant Auth, JWT with `tenant_id` claims, strict middleware routing.

### 3.5 Infrastructure & Deployment

- **Frontend Hosting**: Vercel.
- **Backend Hosting**: Render.
- **Database**: Supabase.

### 3.6 Cross-Cutting Concerns

- Traceability: Mandatory `rule_version` & `citation_id` injected systematically to frontend UI.
- Immutability: Approved reports store rendered HTML snapshot — PDFs always match what was approved.

## 4. Project Phases

### Phase 1: Analyst & Operations View ✅ Complete

- Upload ingest with Supabase Storage and CSV parsing.
- Report type auto-detection (single day → Assessment, multi-day → Intervention Impact).
- QA gates (QA-G1 to QA-G8) enforced at approval.
- Report Draft Builder.
- WeasyPrint PDF generation with immutable snapshot architecture.

### Phase 2: Internal Dashboard (Executive) ✅ Complete

- Dashboard Aggregation Service in FastAPI.
- Executive global view (wellness index, top risks/actions, historical scan selector).
- Cross-site comparison logic sorted by dynamically weighted index.

### Phase 3: Customer Portal ⏳ Gate-locked

- Implementation of Clerk Auth, JWT extraction in FastAPI.
- Tenant isolation (QA-G9).
- Customer portal views (Verification Summary, Certificates, Decals).
- Automatic renewal triggers.

## 5. PR Breakdown — Completed

### PR1: Common Components & Layout Skeleton ✅

- **Scope**: Next.js layout structures, navbar, Shadcn UI base components.
- **Status**: Complete. Layout simplified to 2 routes: `/ops` and `/executive`.

### PR2: Upload & Parse ✅

- **Scope**: FastAPI endpoint for CSV ingest, Supabase Storage helper. Report type auto-detection.
- **Status**: Complete. Single synchronous upload — no queue system.

### PR3: Findings Panel & Rule Evaluation ✅

- **Scope**: Backend route returning findings with `rule_version` and `citation_id` metadata.
- **Status**: Complete. Citations link to rulebook entries via `citation_unit_ids`.

### PR4: Report Draft Builder & QA Checklist ✅

- **Scope**: Report creation, QA checklist form validating against QA-G1 to G8.
- **Status**: Complete. Incremental checklist saving, approval gate enforcement.

### PR5: WeasyPrint PDF Generation Pipeline ✅

- **Scope**: Jinja2 + HTML/CSS template integration. Two templates: Assessment + Intervention Impact.
- **Status**: Complete. Immutable snapshot architecture — HTML stored at approval, PDFs generated on-demand.

### PR6: Executive Dashboard ✅

- **Scope**: Aggregation service, cross-site comparison, Wellness Index, executive summary.
- **Status**: Complete. 5 dashboard endpoints, historical scan selector.

### PR7: Workflow A — Rule Governance ✅

- **Scope**: Rulebook seed script (WHO AQG 2021 + SS554), read-only API, Alembic migrations.
- **Status**: Complete. 3-table design (`reference_source` → `citation_unit` → `rulebook_entry`).

### PR8: UAT Readiness & Production Hardening ✅

- **PR8.1**: Infrastructure bootstrap (Alembic migrations, docker-compose, `.env.example`) ✅
- **PR8.2**: QA gate test fixtures & backend tests (55 passed, 47 skipped) ✅
- **PR8.3**: Dashboard endpoint verification (5 endpoints) ✅
- **PR8.4**: 6 frontend components + upload detail page ✅
- **PR8.5**: Utility scripts + sample datasets ✅
- **PR8.6**: Frontend Vitest tests + production hardening ✅
- **Post-PR8**: Immutable report snapshot architecture (migration 005) ✅

### PR9: Professional Report Template & Customer Info Capture ⏳

- **PR9.1**: Customer info schema & upload form (Site model extension, customer fields on upload)
- **PR9.2**: Readings aggregation & snapshot context (per-zone stats, site info in report context)
- **PR9.3**: Professional report template (cover page, per-zone analysis, recommendations, references)

## 6. Risks, Trade-offs, and Open Questions

- **Risk 1 (Performance)**: Synchronous PDF generation might timeout for large datasets. *Mitigation*: Move to background tasks/Celery if 2 min constraint is consistently breached.
- **Risk 2 (Integration)**: Rulebook runtime API might drift. *Mitigation*: Mock strictly to the `FJDashboard_PRD.md` data constraints during P1 to enforce the contract.
- **Trade-off**: Putting Phase 3 (Auth & Customer view) last speeds up P1 & 2 value delivery to internal team, but means retrofitting tenant-isolation on the models later. Database schema already has `tenant_id` placeholders on `site` and `notification` tables.
- **Open Question**: Will `Insufficient Evidence` be acceptable to executives initially, or do we provide an 'advisory/provisional' pass temporarily? (Current PSD says never default to pass).
- **Open Question**: Does Supabase Storage integration require pre-signed URLs to be generated by FastAPI for the Frontend?
