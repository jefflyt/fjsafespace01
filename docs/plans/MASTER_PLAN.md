# MASTER PLAN: FJDashboard

## 1. Product Summary
- **Problem Statement**: FJ SafeSpace needs an operational and reporting interface to convert approved, rule-based findings into role-appropriate, traceable, and actionable views for internal operators, executives, and eventually customers, without manually overriding thresholds.
- **Target Users**: Internal Analysts/Operators, FJ Executives, and (in Phase 3) Customer Tenants.
- **Value Proposition**: A single source of truth for IAQ reports (Assessment & Intervention Impact) with high traceability, ensuring certification integrity and providing actionable, dynamically-weighted wellness insights via role-gated views.
- **Core Features**: 
  - Traceable, read-only consumption of Rulebook findings.
  - Role-gated views (Analyst upload queue/findings, Executive dashboard/Leaderboard, Customer portal).
  - Two report types (Assessment vs Intervention Impact).
  - Strict QA gates enforcing non-obvious citations, data quality, and auth for certifications.
  - Native Python PDF generation.

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
  - Locked decision: Cloudflare R2 for file storage and native Postgres for database.
  - Assumption: Standard, unthrottled access to Supabase PostgreSQL in production.

## 3. Architecture & Technology Stack
### 3.1 Frontend
- **Framework**: Next.js 15 (App Router, TS), Tailwind CSS, Shadcn UI.
- **Data Fetching**: Centralized `fetch` client to FastAPI (`frontend/lib/api.ts`).

### 3.2 Backend
- **Framework**: Python 3.12+ FastAPI.
- **ORM & DB interaction**: SQLModel with SQLAlchemy, Alembic for migrations.
- **Document Rendering**: WeasyPrint for synchronous HTML-to-PDF generation.

### 3.3 Data
- **Database**: PostgreSQL (Supabase for Prod, Docker Compose for dev).
- **File Storage**: Cloudflare R2 (for raw scan uploads, generated PDF reports).

### 3.4 Auth & Security
- **Phase 1 & Phase 2**: No authentication (internal execution only).
- **Phase 3**: Clerk for Tenant Auth, JWT with `tenant_id` claims, strict middleware routing.

### 3.5 Infrastructure & Deployment
- **Frontend Hosting**: Vercel.
- **Backend Hosting**: Render.
- **Database**: Supabase.

### 3.6 Cross-Cutting Concerns
- Traceability: Mandatory `rule_version` & `citation_id` injected systematically to frontend UI.

## 4. Project Phases
### Phase 1: Analyst & Operations View
- Build upload ingest flow (UI to Backend to File storage).
- Implement QA gates (QA-G1 to QA-G8 except tenant IDs).
- Report Draft Builder (selecting Assessment vs Intervention Impact).
- PDF generation using WeasyPrint and WeasyPrint styling via skills.

### Phase 2: Internal Dashboard (Executive)
- Dashboard Aggregation Service in FastAPI.
- Executive global view (Leaderboard, Site/Zone drilldown, top risks/actions).
- Cross-site comparison logic sorting by dynamically weighted index.

### Phase 3: Customer Portal
- Implementation of Clerk Auth, JWT extraction in FastAPI.
- Tenant isolation (QA-G9).
- Customer portal views (Verification Summary, Certificates, Decals).
- Automatic renewal triggers.

## 5. Initial PR Breakdown (Phase 1)
*(Note: Repository has already been bootstrapped with Next.js and FastAPI folders)*

### PR1: Common Components & Layout Skeleton
- **Goal**: Establish the base layout for Analyst/Operations View.
- **Scope**: Next.js layout structures, navbar, and placeholder pages. Create Shadcn UI base components (buttons, tables, cards).
- **Key Changes**: `frontend/app/layout.tsx`, `frontend/app/analyst/page.tsx`, `frontend/components/ui`.
- **Testing Focus**: Verify basic routing and mobile-responsive layout.
- **Verification Steps**: `pnpm dev` loads successfully with Analyst tab visible.

### PR2: Upload & Parse Queue (Backend + Frontend)
- **Goal**: Allow analysts to upload CSV scans and see processing status.
- **Scope**: FastAPI endpoint for CSV ingest, Cloudflare R2 helper. Upload queue table in frontend.
- **Key Changes**: `backend/app/routers/upload.py`, `backend/app/services/parser.py`, `frontend/app/analyst/upload/page.tsx`.
- **Testing Focus**: Test CSV format validation, robust failure states, and visual progress indicators.
- **Verification Steps**: Upload sample CSV, check if the file processes and status updates in UI.

### PR3: Findings Panel & Rule Evaluation Data Contract
- **Goal**: Display parsed findings accurately, ensuring `rule_version` and `citation_id` metadata.
- **Scope**: Backend route returning findings. Frontend Findings Panel table with source currency badges.
- **Key Changes**: `backend/app/models/findings.py`, `backend/app/routers/findings.py`, `frontend/components/FindingsPanel.tsx`.
- **Testing Focus**: Verifying `Insufficient Evidence` state handles correctly; citations pop up properly.
- **Verification Steps**: Check missing rule context fails gracefully in UI without raising 500s.

### PR4: Report Draft Builder & QA Checklist
- **Goal**: Allow analysts to initiate an Assessment vs Intervention Impact report, tracking QA gates.
- **Scope**: UI for report creation, QA checklist form validating against backend requirements (QA-G1 to G8).
- **Key Changes**: `backend/app/services/qa_gates.py`, `frontend/app/analyst/reports/new/page.tsx`.
- **Testing Focus**: Form shouldn't allow approval unless QA checklist is complete (mock Jay Choy login/signer).
- **Verification Steps**: Simulate failing a QA check and ensure the "Approve & Generate" button is disabled.

### PR5: WeasyPrint PDF Generation Pipeline
- **Goal**: Synthesize approved findings into downloadable PDFs.
- **Scope**: Jinja2 + HTML/CSS template integration with WeasyPrint. FastAPI endpoint to return PDF.
- **Key Changes**: `backend/app/services/pdf_orchestrator.py`, `backend/templates/report_base.html`.
- **Testing Focus**: Synchronous time constraints (< 2m generation), accurate data population.
- **Verification Steps**: Click 'Generate PDF' in UI, wait, and download output to confirm visual formatting.

## 6. Risks, Trade-offs, and Open Questions
- **Risk 1 (Performance)**: Synchronous PDF generation might timeout for large datasets. *Mitigation*: Move to background tasks/Celery if 2 min constraint is consistently breached.
- **Risk 2 (Integration)**: Rulebook runtime API might drift. *Mitigation*: Mock strictly to the `FJDashboard_PRD.md` data constraints during P1 to enforce the contract. 
- **Trade-off**: Putting Phase 3 (Auth & Customer view) last speeds up P1 & 2 value delivery to internal team, but means retrofitting tenant-isolation on the models later.
- **Open Question**: Will `Insufficient Evidence` be acceptable to executives initially, or do we provide an 'advisory/provisional' pass temporarily? (Current PSD says never default to pass).
- **Open Question**: Does Cloudflare R2 integration require pre-signed URLs to be generated by FastAPI for the Frontend?
