# Epic Plan: PR5 - WeasyPrint PDF Generation Pipeline

## 1. Feature/Epic Summary
- **Objective**: Establish the document generation engine capable of reading an "Approved" Report draft from the database, hydrating a Jinja2 template with its findings, and synchronously compiling it into a polished PDF report using WeasyPrint.
- **User Impact**: Transforms raw dashboard data into the final deliverable product (Assessment Reports vs Intervention Impact Reports) that will be shared externally with stakeholders and tenants.
- **Dependencies**: PR4 (The Report Draft must exist and be 'Approved').
- **Assumptions**: 
  - Standard Python `weasyprint` and `Jinja2` are installed in the backend.
  - The generation happens synchronously per the current PRD.
  - System fonts/assets required by the template will be distributed within the Docker/Render environment.

## 2. Complexity & Fit
- **Classification**: Multi-PR
- **Rationale**: Setting up the HTML-to-PDF pipeline requires building out the backend templating infrastructure, designing two distinct complex report layouts visually, and hooking up the file download logic end-to-end. Separating the visual templating from the API transfer logic makes review and styling iteration much cleaner.
- **Estimated PRs**: 3

## 3. Full-Stack Impact
- **Frontend**: The "Download PDF" handler on the Report Detail page. Managing browser blob objects to save files locally.
- **Backend**: WeasyPrint engine instantiation. Jinja2 templating directory. `pdf_orchestrator.py` service. `GET /api/reports/{id}/pdf`.
- **Data**: Update `Report` table with a `pdf_url` (pointing to the generated PDF saved in R2) or standardizing around streaming responses.
- **Infra/Config**: Linux dependencies for WeasyPrint (like `pango`, `cairo`, `libffi`) need to be explicitly configured in the deployment environment (`Dockerfile` or Render build script).

## 4. PR Roadmap

### PR 5.1: WeasyPrint Engine & Infra Setup
- **Goal**: Configure the Python backend to reliably convert basic HTML+CSS into PDFs.
- **Scope (in)**: Adding WeasyPrint to `requirements.txt`. Adding a simplified `pdf_orchestrator.py` with Jinja2 environment setup. Boilerplate `base.html` and `style.css`.
- **Scope (out)**: Actual data hydration from DB models or complex dashboard visualizations. API endpoints.
- **Key Changes**: `backend/requirements.txt`, `backend/app/services/pdf_orchestrator.py`, `backend/templates/base.html`.
- **Testing**: Python script test that generates a `hello_world.pdf` from a minimal Jinja file successfully.
- **Verification**: Run `pytest` locally and visually verify the test PDF outputs correctly formatted text.
- **Rollback Plan**: Revert dependency updates and scripts.
- **Dependencies**: None natively, but assumes you can build Python `WeasyPrint` locally.

### PR 5.2: Report Templates (Assessment & Intervention) 
- **Goal**: Design the layout and hydrate the templates with actual Report/Findings data models.
- **Scope (in)**: Structuring `assessment_report.html` and `intervention_impact_report.html`. Writing the logic in `pdf_orchestrator.py` to accept a `Report` DB object and inject it into the Jinja context. Handling complex charts (if rendering via HTML/CSS shapes or static SVGs).
- **Scope (out)**: Endpoint routing and R2 saves.
- **Key Changes**: `backend/templates/assessment/index.html`, `backend/templates/intervention/index.html`, CSS assets.
- **Testing**: Manual visual testing by rendering mock Report objects to PDFs and inspecting the layout (margins, page breaks, typography).
- **Verification**: Ensure the "Disclaimer" and "Data Quality Statement" variables render exactly per the legal requirements in the PSD.
- **Rollback Plan**: Revert template additions.
- **Dependencies**: PR 5.1 (WeasyPrint engine) and PR 4.1 (Report Data Models).

### PR 5.3: End-to-End PDF Generation & Frontend Download
- **Goal**: Hook the generation engine to the REST API and the Next.js UI.
- **Scope (in)**: `GET /api/reports/{id}/pdf` endpoint (triggering the orchestrator). Optionally pushing the result to Cloudflare R2 and returning a URL, or streaming the PDF block back directly. Frontend Blob to File download logic.
- **Scope (out)**: Real-time progress bars (it's a synchronous wait until it finishes).
- **Key Changes**: `backend/app/routers/reports.py`, `frontend/app/analyst/reports/[id]/page.tsx` (the Download logic).
- **Testing**: Assert synchronous response respects the `< 2m` timeout rule. Handle timeouts gracefully in the UI.
- **Verification**: Go to the UI, view an Approved report, click "Download PDF", wait, and ensure the browser natively downloads `FJDashboard_Report_{ID}.pdf`.
- **Rollback Plan**: Revert router and UI logic.
- **Dependencies**: PR 5.2.

## 5. Milestones & Sequence
- **Milestone 1**: PDF Engine Operational (PR 5.1). The server has the correct OS-level dependencies to generate SVGs/PDFs without segfaults.
- **Milestone 2**: Beautiful Deliverables (PR 5.2). The visual styling matches FJ SafeSpace branding.
- **Milestone 3**: Export Ready (PR 5.3). The Analyst workflow is complete, unlocking the end of Phase 1.

## 6. Risks, Trade-offs, and Open Questions
- **Major Risks**: 
  - **OS Dependencies**: WeasyPrint relies on system libraries (`Pango`, `Cairo`). These are notoriously finicky across macOS (dev) and Linux/Ubuntu (prod). Local dev might work while CI/CD fails. *Mitigation: Ensure the Dockerfile explicitly specifies these system packages.*
  - **Synchronous Timeout**: If generating a 50-page PDF takes longer than Vercel's or Render's HTTP proxy timeout (usually 30s-60s), the request will 504. *Mitigation: We may need to evaluate async backgrounds tasks (Celery) earlier than planned if WeasyPrint is slow.*
- **Trade-offs**: 
  - Using HTML/CSS (WeasyPrint) instead of a direct PDF canvas drawing lib (like ReportLab) gives us incredibly fast layout iterations and flexbox support, trading off slight raw processing speed and file size optimization.
- **Open Questions**: How do we handle graphs and charts in the PDF? (Next.js Recharts are client-side only. We may need to pass base64 image strings from the frontend, or use pure CSS/SVG tricks in the Jinja HTML itself).
