# FJDashboard — Technical Design Document

| Field | Value |
|---|---|
| **Document** | FJDashboard TDD v0.1 |
| **Date** | 2026-04-12 |
| **Owner** | Jeff |
| **PM** | Lyra |
| **Status** | Draft for Review |
| **Parent PRD** | FJDashboard PRD v1.1 (`FJDashboard_PRD.md`) |
| **Parent PSD** | FJDashboard PSD-02 v0.2 (`FJDashboard_PSD.md`) |

---

## 0. Document Control

| Field | Detail |
|---|---|
| **Purpose** | Define the technical implementation of FJDashboard across all three phases |
| **Source of truth** | This document governs architecture, schema, API contracts, and infrastructure decisions |
| **Change control** | Any change to schema, API contracts, or infrastructure requires a version bump and decision-log entry |
| **Approval authority** | Jeff (technical decisions); Jay Choy (certification logic and rule governance) |

---

## 1. System Architecture Overview

### 1.1 Architecture Style

- **Decoupled Architecture**: Next.js App Router for frontend UI, connecting to a separate Python backend.
- **FastAPI Backend**: Handles all business logic, CSV parsing, rule evaluation, and PDF orchestration.
- **Database access via SQLModel** (Python ORM based on SQLAlchemy) connected to managed PostgreSQL on Render.
- All processing is **synchronous**. No background job queue.

### 1.2 Component Diagram

```
[Analyst / Ops User]
        │
        ▼
[Next.js App on Vercel]
  ├── Frontend UI (App Router)
  └── Fetches from API

[FastAPI Backend on Render]
  ├── REST Endpoints (/api/*)        
  ├── Parse & Validation Service (Pydantic)
  ├── Rule Evaluation Service
  └── PDF Orchestration
          ↓
[PostgreSQL on Render] ←── SQLModel / SQLAlchemy
        │
        ├──▶ [Rulebook DB tables]    (read-only from dashboard services)
        └──▶ [Findings / Reports tables]

[CSV Upload]
  └──▶ POST /api/uploads
        ├── parse + validate  (synchronous)
        ├── evaluate vs Rulebook  (read-only)
        ├── write findings to DB
        └── return result to UI

[Report Generation]
  └──▶ POST /api/reports/generate
        ├── compose HTML from findings
        ├── HTML→PDF via WeasyPrint
        ├── store PDF binary in PostgreSQL (`bytea`)
        ├── store Report record in DB
        └── return download URL

[Phase 3 — Customer Portal]
  └──▶ Clerk middleware (tenant_id from JWT)
        └── tenant-scoped DB queries only
```

### 1.3 Workflow Separation

| Workflow | Purpose | Access |
|---|---|---|
| **Workflow A** | Standards governance (Reference Vault → Rulebook) | Admin console at `/admin` only |
| **Workflow B** | Scan-to-Report operations | Core dashboard application |

> Dashboard services **never write to Rulebook tables**. Workflow A admin console uses a separate DB role with full privileges.

### 1.4 Deployment Model

| Phase | Deployment |
|---|---|
| **Phase 1/2** | `npm run dev` on analyst's internal laptop. PostgreSQL via Docker or Render free tier. Not internet-accessible. |
| **Phase 3** | Vercel (production) + Render (managed PostgreSQL). Clerk middleware enforces tenant isolation on all customer routes. |

---

## 2. Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Backend API** | FastAPI | 0.x | Ultra-fast Python framework |
| **Frontend UI** | Next.js App Router| 15.x | React Server Components |
| **Backend Language**| Python | 3.12+ | Pydantic data validation |
| **Frontend Language**| TypeScript | 5.x | End-to-end type safety |
| **ORM** | SQLModel | 0.x | SQLAlchemy wrapper |
| **Database** | PostgreSQL | 16.x | Render managed DB |
| **File storage** | PostgreSQL `bytea` | — | Direct DB binary storage (Lean MVP) |
| **PDF generation** | WeasyPrint | 62.x | Native Python HTML→PDF rendering library |
| **Auth (Phase 1/2)** | None | — | Internal laptop only; no login |
| **Auth (Phase 3)** | Clerk | 5.x | Org = tenant; JWT; Next.js middleware native |
| **Email notifications** | Resend | — | In-app via Notification DB table + polling |
| **State / Fetching (Frontend)** | TanStack Query | 5.x | Server state polling and caching |
| **Charts** | Tremor / Shadcn | — | Premium dashboard visualizations |
| **Styling** | Tailwind + Shadcn UI | — | Radix-based accessible components |
| **Deployment (Phase 1/2)** | localhost | — | `npm run dev` on analyst machine |
| **Deployment (Phase 3)** | Vercel | — | Auto-deploy on push to `main` |

---

## 3. Database Schema

> All tables use UUID primary keys. Timestamps are UTC ISO8601. Migrations managed by Alembic.

### 3.1 Enums

```python
enum ParseStatus        { PENDING PROCESSING COMPLETE FAILED }
enum ParseOutcome       { PASS PASS_WITH_WARNINGS FAIL }
enum MetricName         { co2_ppm pm25_ugm3 tvoc_ppb temperature_c humidity_rh }
enum ThresholdBand      { GOOD WATCH CRITICAL }
enum ConfidenceLevel    { HIGH MEDIUM LOW }
enum BenchmarkLane      { FJ_SAFESPACE }
enum ReviewerStatus     { DRAFT_GENERATED IN_REVIEW REVISION_REQUIRED APPROVED EXPORTED }
```

### 3.2 Workflow B Tables (Scan → Report)

```python
model Site {
  id        String    @id @default(uuid())
  name      String
  tenantId  String?   // null Phase 1/2; required Phase 3
  createdAt DateTime  @default(now())

  readings      Reading[]
  uploads       Upload[]
  reports       Report[]
  tenant        Tenant? @relation(fields: [tenantId], references: [id])
}

model Upload {
  id              String        @id @default(uuid())
  siteId          String
  fileName        String
  uploadedBy      String
  uploadedAt      DateTime      @default(now())
  parseStatus     ParseStatus   @default(PENDING)
  parseOutcome    ParseOutcome?
  ruleVersionUsed String?
  warnings        Json?         // string[]

  site     Site      @relation(fields: [siteId], references: [id])
  readings Reading[]
  findings Finding[]
  report   Report?
}

model Reading {
  id               String     @id @default(uuid())
  uploadId         String
  siteId           String
  deviceId         String
  readingTimestamp DateTime
  metricName       MetricName
  metricValue      Float
  metricUnit       String
  isOutlier        Boolean    @default(false)
  createdAt        DateTime   @default(now())

  upload Upload @relation(fields: [uploadId], references: [id])
  site   Site   @relation(fields: [siteId], references: [id])
}

model Finding {
  id                   String         @id @default(uuid())
  uploadId             String
  siteId               String
  zoneName             String
  metricName           MetricName
  thresholdBand        ThresholdBand
  interpretationText   String
  workforceImpactText  String
  recommendedAction    String
  ruleId               String
  ruleVersion          String
  citationUnitIds      String[]       // required; absence → QA-G5
  confidenceLevel      ConfidenceLevel
  sourceCurrencyStatus SourceCurrency // NOT NULL enforced
  benchmarkLane        BenchmarkLane
  createdAt            DateTime       @default(now())

  upload Upload @relation(fields: [uploadId], references: [id])
}


model Report {
  id                 String         @id @default(uuid())
  uploadId           String         @unique
  siteId             String
  reportVersion      Int            @default(1)
  ruleVersionUsed    String
  citationIdsUsed    String[]
  reviewerName       String?
  reviewerStatus     ReviewerStatus @default(DRAFT_GENERATED)
  reviewerApprovedAt DateTime?
  pdfBinaryData      LargeBinary?   // Stored directly as bytea in PostgreSQL
  generatedAt        DateTime       @default(now())

  upload Upload @relation(fields: [uploadId], references: [id])
  site   Site   @relation(fields: [siteId], references: [id])
}
```

### 3.3 Workflow A Tables (Reference Vault → Rulebook)

```python
model ReferenceSource {
  id                       String    @id @default(uuid())
  title                    String
  publisher                String
  sourceType               String    // standard|guideline|whitepaper|vendor
  jurisdiction             String
  url                      String?
  fileStorageKey           String?
  checksum                 String?
  versionLabel             String?
  publishedDate            DateTime?
  effectiveDate            DateTime?
  ingestedAt               DateTime  @default(now())
  status                   String    // active|superseded|retired
  sourceCurrencyStatus     SourceCurrency
  sourceCompletenessStatus String?
  lastVerifiedAt           DateTime?

  citationUnits CitationUnit[]
}

model CitationUnit {
  id                      String   @id @default(uuid())
  sourceId                String
  pageOrSection           String?
  exactExcerpt            String
  metricTags              String[]
  conditionTags           String[]
  extractedThresholdValue Float?
  extractedUnit           String?
  extractionConfidence    Float?
  extractorVersion        String?
  needsReview             Boolean  @default(true)

  source ReferenceSource  @relation(fields: [sourceId], references: [id])
  rules  RulebookEntry[]  @relation("CitationToRule")
}

model RulebookEntry {
  id                     String          @id @default(uuid())
  metricName             MetricName
  thresholdType          String          // range|upper_bound|lower_bound
  minValue               Float?
  maxValue               Float?
  unit                   String
  contextScope           String          // office|industrial|school|residential|general
  interpretationTemplate String
  businessImpactTemplate String
  recommendationTemplate String
  priorityLogic          Priority
  indexWeightPercent     Float?          // The weighting block (e.g., 25.0) for this metric pulled from documentation anchor
  confidenceLevel        ConfidenceLevel
  ruleVersion            String
  effectiveFrom          DateTime
  effectiveTo            DateTime?
  approvalStatus         String          // draft|approved|superseded
  approvedBy             String?
  approvedAt             DateTime?

  citationUnits CitationUnit[] @relation("CitationToRule")
}
```

### 3.4 Supporting Tables

```python
model Tenant {
  id                   String    @id @default(uuid())
  tenantName           String
  contactEmail         String
  certificationDueDate DateTime?
  createdAt            DateTime  @default(now())

  sites Site[]
}

model Notification {
  id        String   @id @default(uuid())
  userId    String?  // null = broadcast to ops team
  tenantId  String?
  type      String   // alert_new|alert_overdue|report_approved|renewal_due
  title     String
  body      String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

### 3.5 Key Database Constraints

| Constraint | Enforcement |
|---|---|
| `RulebookEntry` — read-only from dashboard | App DB role: `SELECT` only on rulebook tables |
| `Finding.sourceCurrencyStatus` | `NOT NULL` at DB level |

---

## 4. API Contract Design (FastAPI Endpoints)

> All routes live under `/app/api/`. Responses are JSON unless noted.
> **Phase 1/2:** No auth headers required.
> **Phase 3:** Clerk session token required; `tenant_id` extracted from JWT.

### 4.1 Upload Routes

```
POST /api/uploads
  Body: multipart/form-data
    file:    CSV file (required)
    siteId:  string (required)
    context: string (optional — office|industrial|residential)
  Processing: synchronous — parse → validate → normalise → rule evaluate → write findings
  Returns 200: { uploadId, parseStatus, parseOutcome, warnings[], findingCount, failedRowCount }
  Returns 422: if required columns missing or ruleVersion unavailable

GET /api/uploads/[id]
  Returns: { uploadId, parseStatus, parseOutcome, warnings[], uploadedAt, fileName }

GET /api/uploads/[id]/findings
  Returns: [{ findingId, zoneName, metricName, metricValue, metricUnit,
              thresholdBand, interpretationText, workforceImpactText,
              recommendedAction, alertPriority, ruleId, ruleVersion,
              citationUnitIds[], confidenceLevel, sourceCurrencyStatus, benchmarkLane }]
  Validation: finding missing ruleVersion or citationUnitIds → 422 (enforces QA-G5)
```

### 4.2 Dashboard Routes

```
GET /api/dashboard/sites
  Returns: [{ siteId, siteName, certificationOutcome, wellnessIndexScore,
              top3Risks[], top3Actions[], nextVerificationDate, lastScanDate }]
  Note: certificationOutcome = INSUFFICIENT_EVIDENCE when no valid rule set applies (never null)

GET /api/dashboard/sites/[id]/zones
  Returns: [{ zoneName, metrics: [{ metricName, currentValue, unit,
              thresholdBand, sourceCurrencyStatus, benchmarkLane, sparklineData[] }] }]

GET /api/dashboard/comparison
  Returns: [{ siteId, siteName, wellnessIndexScore,
              certificationOutcome, lastScanDate }]
  Sort: wellnessIndexScore DESC

GET /api/dashboard/summary
  Returns: { top3Risks[], top3Actions[], nextVerificationDate, dataAsOf }
```

### 4.5 Report Routes

```
POST /api/reports/generate
  Body: { uploadId }
  Processing (synchronous):
    1. Fetch findings for upload
    2. Validate QA gates — fail fast on first violation
    3. Compose HTML report from template
    4. Render HTML to PDF via WeasyPrint library
    5. Save PDF bytes to Report.pdfBinaryData in PostgreSQL
    6. Write Report record to DB
  Returns 200: { reportId, status: "DRAFT_GENERATED", previewUrl }
  Returns 422: { gate, message } for each failed QA gate

GET /api/reports/[id]
  Returns: { reportId, siteId, reportVersion, ruleVersionUsed,
             citationIdsUsed[], reviewerStatus, generatedAt }

PATCH /api/reports/[id]/status
  Body: { reviewerStatus, reviewerName }
  Allowed state transitions:
    DRAFT_GENERATED → IN_REVIEW
    IN_REVIEW → REVISION_REQUIRED
    IN_REVIEW → APPROVED  (Jay Choy only for certification outcomes)
    REVISION_REQUIRED → IN_REVIEW
    APPROVED → EXPORTED
  Returns 200: updated report

GET /api/reports/[id]/export
  Returns: PDF stream from PostgreSQL `bytea` (Content-Type: application/pdf)
```

### 4.6 Rulebook Routes (Read-Only)

```
GET /api/rulebook/rules
  Query params (optional): metricName, contextScope, approvalStatus
  Returns: [RulebookEntry]  ← SELECT only; no mutations permitted

GET /api/rulebook/rules/[id]
  Returns: single RulebookEntry with citationUnits[]

GET /api/rulebook/sources
  Returns: [ReferenceSource] with sourceCurrencyStatus
```

### 4.7 Notification Routes

```
GET /api/notifications
  Returns: [{ id, type, title, body, isRead, createdAt }]
  Phase 3: scoped to tenant from JWT

PATCH /api/notifications/[id]/read
  Marks notification as read
```

### 4.8 QA Gate Enforcement

Applied in `POST /api/reports/generate` before any processing begins:

| Gate | Field Checked | Fail Condition |
|---|---|---|
| QA-G4 | `dataQualityStatement` | Absent or not confirmed by analyst |
| QA-G5 | `finding.ruleVersion` + `citationUnitIds` | Absent from any certification-impact finding |
| QA-G6 | `finding.sourceCurrencyStatus` | Non-`CURRENT_VERIFIED` without advisory label |
| QA-G7 | `certificationOutcome` | `null` when no applicable rule set exists |
| QA-G8 | `reviewerName` | Does not match configured approver for cert outcomes |
| QA-G9 | `tenant_id` (Phase 3) | Absent or mismatched on customer request |

---

## 5. Frontend Architecture

### 5.1 Next.js Frontend Structure (app directory)

```
app/
├── layout.tsx                          ← root layout (fonts, Tailwind, Shadcn UI, nav shell)
├── page.tsx                            ← redirect → /dashboard
│
├── dashboard/
│   ├── layout.tsx                      ← dashboard shell (sidebar, phase-aware nav)
│   ├── page.tsx                        ← role router (Phase 1/2 → /analyst)
│   ├── executive/
│   │   └── page.tsx                    ← Executive View (Phase 2+)
│   └── analyst/
│       ├── page.tsx                    ← Analyst View (Phase 1+)
│       ├── upload/page.tsx             ← CSV upload form
│       ├── uploads/[id]/page.tsx       ← Parse result + Findings Panel
│       └── reports/[id]/page.tsx       ← Report preview + QA checklist
│
├── admin/
│   └── page.tsx                        ← Workflow A: Rulebook governance console
│
├── customer/                           ← Phase 3 only; Clerk middleware required
│   ├── layout.tsx                      ← customer shell (tenant-scoped nav)
│   ├── page.tsx                        ← Customer portal home
│   └── status/page.tsx                 ← FJ SafeSpace Wellness Index + certification status
│
└── lib/
    ├── api.ts                          ← Fetch client for FastAPI backend
    └── components/                     ← Shared React components

### 5.2 FastAPI Backend Structure (Python)

```
backend/
├── app/
│   ├── main.py                         ← FastAPI application instance
│   ├── api/
│   │   ├── routers/                    ← Endpoints (uploads, dashboard, reports, rulebook)
│   │   └── dependencies.py             ← Auth checks, DB session yielding
│   ├── services/                       ← Pydantic parsers, rule engine, PDF orchestrator
│   ├── models/                         ← SQLModel definitions (DB tables)
│   ├── core/                           ← Config, env variables
│   └── database.py                     ← SQLAlchemy engine configuration
```

### 5.3 Key UI Components

| Component | Location | Purpose |
|---|---|---|
| `WellnessIndexCard` | `components/dashboard/` | Certification outcome chip + index score dial |
| `CrossSiteComparisonTable` | `components/ops/` | Wellness Index columns; ranked descending |
| `FindingsPanel` | `components/analyst/` | Per-metric rows with citation badge + source currency badge |
| `CitationDrawer` | `components/shared/` | Slide-out: `citation_unit_id`, source, `rule_version` detail |
| `SourceCurrencyBadge` | `components/shared/` | Colour-coded badge + advisory tag for non-`CURRENT_VERIFIED` |
| `QAChecklist` | `components/analyst/` | Gated checklist — blocks approval button until all items checked |
| `DailySummaryCard` | `components/dashboard/` | Top 3 risks + actions + next verification date |
| `TrendChart` | `components/shared/` | Tremor / Shadcn chart — pre/post intervention comparison |
| `UploadForm` | `components/analyst/` | CSV file input + site selector + parse result display |
| `ReportPreview` | `components/analyst/` | Rendered report sections; approval action button |
| `NotificationBell` | `components/shared/` | Unread count badge + dropdown list |

### 5.4 Colour Coding

**FJ SafeSpace Wellness Index / Certification Outcome:**

| Outcome | Tailwind Token | Display Label |
|---|---|---|
| `HEALTHY_WORKPLACE_CERTIFIED` | `green-600` | Healthy Workplace Certified |
| `HEALTHY_SPACE_VERIFIED` | `amber-500` | Healthy Space Verified |
| `IMPROVEMENT_RECOMMENDED` | `red-600` | Improvement Recommended |
| `INSUFFICIENT_EVIDENCE` | `slate-500` | Insufficient Data *(tooltip: "Insufficient rule coverage for this context")* |

**Source Currency Badge:**

| Status | Badge Colour | Tag |
|---|---|---|
| `CURRENT_VERIFIED` | Green | *(none)* |
| `PARTIAL_EXTRACT` | Amber | "Advisory Only" |
| `VERSION_UNVERIFIED` | Amber | "Advisory Only" |
| `SUPERSEDED` | Red | "Superseded — not valid for certification" |

---

## 6. Security and Auth Design

### 6.1 Phase 1/2 — No Authentication

- Application runs on analyst's internal laptop (Next.js on 3000, FastAPI on 8000).
- **No login page, no session, no JWT.**
- All FastAPI routes are open — no auth middleware.
- Not deployed to the internet. No customer network access in Phase 1/2.
- Rulebook mutations blocked at DB permission level (app DB role: `SELECT` only on rulebook tables).

### 6.2 Phase 3 — Clerk Authentication

- Clerk middleware defined in `middleware.ts` at project root — protects `/customer/*` routes.
- **Clerk Organisation = Tenant** (one org per customer).
- clerk org ID passed to FastAPI from Next.js via signed JWT.
- All customer-scoped DB queries include `WHERE tenant_id == clerkOrgId` via SQLModel — cross-tenant access is impossible by design.
- `tenant_id` sourced from JWT only — never from the request body.

### 6.3 Approval Role Enforcement (All Phases)

- Jay Choy's approver identity stored in environment variable: `APPROVER_EMAIL`.
- `PATCH /api/reports/[id]/status → APPROVED` calculates and validates reviewer matches `APPROVER_EMAIL`.
- Phase 1/2: checked against manually entered reviewer name in UI.
- Phase 3: checked against Clerk `userId` of signed-in user.

### 6.4 Rulebook Write Protection

| DB Role | Tables | Permissions |
|---|---|---|
| App role (`DATABASE_URL`) | All Workflow B tables | Full read/write |
| App role (`DATABASE_URL`) | `RulebookEntry`, `CitationUnit`, `ReferenceSource` | `SELECT` only |
| Admin role (`ADMIN_DATABASE_URL`) | All tables | Full read/write |

> No Route Handler in the dashboard codebase uses `ADMIN_DATABASE_URL`. Workflow A admin console is an isolated module.

---

## 7. Notification System Design

### 7.1 In-App Notifications

- Stored in `Notification` table; frontend polls `GET /api/notifications` every 60 seconds.
- `NotificationBell` component shows unread count badge.
- Phase 3: evaluate WebSocket upgrade if 60-second polling latency is insufficient.

### 7.2 Email Notifications

- Provider: Resend (`RESEND_API_KEY` in environment).
- Triggered synchronously from Route Handlers at the point of event.
- HTML templates stored in `/lib/email-templates/`.

### 7.3 Trigger Table

| Trigger | In-App | Email | Recipients |
|---|---|---|---|
| Report approved (internal) | ✅ | ❌ | Analyst who uploaded |
| Renewal due in 30 days (Phase 3) | ✅ | ✅ | Customer contact + internal ops |

---

## 8. Testing Strategy

### 8.1 Backend Unit Tests (PyTest) & Frontend Unit Tests (Vitest)

| Test | Description |
|---|---|
| Rule evaluation determinism | Same reading + same `ruleVersion` → identical finding every time |
| Parse outcome state machine | `PASS / PASS_WITH_WARNINGS / FAIL` transitions correct |
| QA gate enforcement | Each gate individually asserted — fail fast on first violation |
| `SourceCurrencyBadge` render | Advisory tag shown for `PARTIAL_EXTRACT` and `VERSION_UNVERIFIED` |
| `QAChecklist` gate | Approval button disabled until all checklist items checked |

### 8.2 Integration Tests

| Test | Description |
|---|---|
| Full upload pipeline | `POST /api/uploads` → parse → findings → DB written correctly |
| Cross-site comparison sort | Sites returned sorted by wellnessIndexScore DESC; |
| Rulebook read-only | `PUT/POST/DELETE /api/rulebook/*` returns `405` |
| Report QA gate block | `POST /api/reports/generate` returns `422` when a QA gate rule is violated |
| WeasyPrint integration | Render test HTML string to WeasyPrint and assert output is valid PDF bytes |
| PDF Storage | PDF bytes successfully saved to `Report.pdfBinaryData` |

### 8.3 QA Gate Automation (CI)

- Each QA gate (QA-G1 to QA-G9) has a **dedicated test fixture** violating exactly that gate.
- Test asserts: `POST /api/reports/generate` returns `422` with the correct gate identifier.
- **All 9 gate tests must pass before merge to `main`.**

### 8.4 End-to-End Tests (Playwright)

| Test | Dataset |
|---|---|
| NPE dry-run | NPE sample upload → dashboard renders → Executive view shows top risks within 5 minutes |
| CAG dry-run | CAG sample upload with data gaps → `INSUFFICIENT_EVIDENCE` displayed |
| Cross-site comparison | 2 site uploads → comparison table ranks by wellness index score correctly |

### 8.5 Performance Tests

| Scenario | Target | Tool |
|---|---|---|
| Dashboard page load | < 3 seconds | Playwright perf API / Lighthouse |
| Report generation | < 2 minutes | PyTest timer assertion on synchronous handler |
| Upload + parse (1,000 rows) | < 30 seconds | PyTest integration test |

### 8.6 Phase 3 Security Tests

| Test | Description |
|---|---|
| Tenant isolation | Customer A JWT: assert `/api/dashboard/sites` returns only Customer A sites |
| Cross-tenant block | Customer A JWT + Customer B `siteId` → `403` |

---

## 9. Infrastructure and Deployment

### 9.1 Phase 1/2 — Local Development

| Component | Setup |
|---|---|
| Next.js app | `pnpm run dev` (localhost:3000) |
| FastAPI Backend | `fastapi dev backend/app/main.py` (localhost:8000) |
| PostgreSQL | Docker (`docker-compose up`) or Render free tier |
| Environment | `.env` (Backend) & `.env.local` (Frontend) |
| Migrations | `alembic upgrade head` |

### 9.2 docker-compose.yml

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: fjsafespace
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 9.3 Phase 3 — Production Deployment

| Component | Provider | Notes |
|---|---|---|
| Next.js Frontend | Vercel | Auto-deploy on push to `main` |
| FastAPI Backend | Render (Web Service) | Handles rule engine and connects to Postgres |
| PostgreSQL | Render (managed DB)| Automated daily backups; SSL enforced; pgBouncer connection pooling |
| File storage | PostgreSQL Base | Stored as bytea blob natively in the app database |
| Auth | Clerk | Org creation = tenant onboarding; JWKS endpoint auto-configured |
| Email | Resend | Verified sender domain required before Phase 3 go-live |

### 9.4 Environment Variables

| Variable | Ph 1/2 | Ph 3 | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | DB connection string for SQLAlchemy |
| `ADMIN_DATABASE_URL` | ✅ | ✅ | Workflow A admin DB role (full rulebook access) |
| `RESEND_API_KEY` | ✅ | ✅ | Email dispatch via Resend |
| `APPROVER_EMAIL` | ✅ | ✅ | Jay Choy's email — enforced in report approval gate |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ❌ | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ❌ | ✅ | Clerk secret key |

### 9.5 Availability (Phase 3)

- **Target:** 99.5% uptime (planned maintenance excluded).
- Achieved via Vercel edge availability + Render managed DB with automated failover.
- **12-month review:** evaluate upgrade to 99.9% after Phase 3 stabilisation.

---

## 10. Before-Build Checklist

### 10.1 Before Development Starts

- [ ] Finalise SQLModel models and generate initial Alembic migration
- [ ] Set up `docker-compose.yml` for local development
- [ ] Confirm `APPROVER_EMAIL` value with Jeff / Jay Choy
- [ ] Obtain sample datasets: NPE site CSV and CAG site CSV for dry-run tests
- [ ] Test WeasyPrint with a sample HTML report template — verify PDF output quality

### 10.2 Before Phase 3 Gate

- [ ] Set up Clerk account; create organisation structure matching FJ customer list
- [ ] Configure Render production environment (managed DB, cron)
- [ ] Complete Clerk middleware integration (`middleware.ts`)
- [ ] Conduct penetration test for tenant isolation (AC-D15)
- [ ] Obtain legal/medical disclaimer wording approval — Jay Choy sign-off (AC-D16)
- [ ] Verify Resend sender domain for production email delivery

### 10.3 FJ Differentiation Requirements — Code-Level Verification

| Requirement | Enforcement Point |
|---|---|
| D1: `rule_version` + `citation_id` present | Checked in `GET /api/uploads/[id]/findings` — returns `422` if absent |
| D2: `sourceCurrencyStatus` badge | `SourceCurrencyBadge` in `FindingsPanel` and `AlertCenterTable` |
| D3: Rulebook read-only | App DB role: `SELECT` only on rulebook tables |
| D4: `INSUFFICIENT_EVIDENCE` returned | `certificationOutcome` never `null` — service returns `INSUFFICIENT_EVIDENCE` |
| D5: Advisory label enforced | `SourceCurrencyBadge` renders advisory tag for non-`CURRENT_VERIFIED` sources |

---

## References

| # | Document | Location |
|---|---|---|
| 1 | FJDashboard PRD v1.1 | `FJDashboard_PRD.md` (2026-04-11) |
| 2 | FJDashboard PSD-02 v0.2 | `FJDashboard_PSD.md` (2026-04-12) |
| 3 | Next.js App Router docs | https://nextjs.org/docs/app |
| 4 | Prisma docs | https://www.prisma.io/docs |
| 5 | WeasyPrint docs | https://weasyprint.org/ |
| 6 | Clerk Next.js docs | https://clerk.com/docs/nextjs |
| 7 | Shadcn UI docs | https://ui.shadcn.com |
| 8 | Tremor docs | https://tremor.so |
| 9 | TanStack Query docs | https://tanstack.com/query/latest |
