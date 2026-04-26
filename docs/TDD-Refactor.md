# Technical Design Document: FJ SafeSpace Dashboard (PSD-R1 Refactor)

> **TDD Version**: 1.0 — Refactor
> **Date**: 2026-04-23
> **Author**: Jeff (with claude-flow)
> **Derived from**: docs/PSD-Refactor.md (PSD-R1 v0.1)
> **Scope**: R1 (Adhoc Scan Dashboard) + R2 (Continuous Monitoring) + R3 (PDF Pipeline)
> **Decision Log**: See section 9

---

## 1. Architecture Overview

### 1.1 System Diagram (Text)

```text
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Next.js 15     │────▶│  FastAPI Backend     │────▶│  Supabase        │
│  (App Router)   │◀────│  Python 3.12+        │◀────│  PostgreSQL      │
│  Vercel         │     │  Render              │     │                  │
└─────────────────┘     └──────────────────────┘     └──────────────────┘
         │                          │                        │
         │                          │                        ▼
         │                          │               ┌──────────────────┐
         │                          │               │  Supabase Auth   │
         │                          │               │  (Facility Mgrs) │
         │                          │               └──────────────────┘
         │                          │
         │                          │               ┌──────────────────┐
         │                          │───────POST───▶│  Supabase Storage│
         │                          │               │  (iaq-scans)     │
         │                          │               └──────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐     ┌──────────────────────┐
│  Facility Mgr   │     │  uHoo API (R2)       │
│  (Supabase Auth)│◀────│  Polling service     │
└─────────────────┘     └──────────────────────┘
```

### 1.2 Layer Boundaries

| Layer | Technology | Responsibility |
| --- | --- | --- |
| **Frontend** | Next.js 15, App Router, TypeScript, Shadcn UI, Recharts | UI rendering, user interaction, data display. Thin client — all business logic in backend. |
| **Backend** | FastAPI, Python 3.12+, SQLModel | API routing, rule evaluation, data aggregation, tenant isolation, CSV parsing, wellness index calculation. |
| **Database** | PostgreSQL (Supabase) | Persistent data storage, tenant-scoped queries via app-level middleware (RLS is defense-in-depth). |
| **Storage** | Supabase Storage (iaq-scans bucket) | Raw CSV upload storage only. No PDFs stored. |
| **Auth** | Supabase Auth | Facility manager login (email + magic link). JWT passed to backend. FJ staff has no auth in R1. |

### 1.3 Dual Evaluation Path (Key Architectural Decision)

The rule engine has **two evaluation paths** (PSD §6.2):

1. **Wellness Index path** — uses strict RulebookEntry threshold values.
   Never modified by users. Produces the objective 0-100 score.
2. **Alert trigger path** — uses user-adjusted thresholds (within safe
   bounds defined by rulebook min/max). Only affects when "Action Required"
   alerts fire.

Both paths share the same rulebook source but diverge at threshold lookup.
This ensures the wellness index remains an objective standard while allowing
facility managers to customize notification sensitivity.

### 1.4 External Dependencies

| Service | Purpose | Integration Pattern |
| --- | --- | --- |
| **Supabase PostgreSQL** | Primary data store | SQLModel ORM, synchronous queries |
| **Supabase Storage** | CSV upload persistence | Direct upload from backend (service role key) |
| **Supabase Auth** | Facility manager authentication | JWT verification in FastAPI middleware |
| **uHoo API (R2)** | Live device data | Backend polling service (5-15 min interval), stored in readings table |
| **Resend API (R2)** | Email alerts | HTTP POST from backend alert service |

---

## 2. Technology Stack

| Component | Technology | Justification |
| --- | --- | --- |
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI, Recharts | Existing investment (PR1-8). Proven stack for dashboard UIs. |
| **Backend** | FastAPI, Python 3.12+, SQLModel (SQLAlchemy 2.x) | Existing investment. Synchronous pipeline matches current architecture. |
| **Database** | PostgreSQL 16 (Supabase prod, Docker Compose local) | Existing infra. Supports JSON columns for snapshots, array columns for tags. |
| **Storage** | Supabase Storage (iaq-scans bucket) | Existing. Raw CSV uploads only. |
| **Auth** | Supabase Auth (R1 setup, R2 enforcement) | Single Supabase project. Magic link flow for non-technical users. |
| **Migrations** | Alembic | Existing. Reversible schema changes. |
| **Email** | Resend API (R2) | Existing `RESEND_API_KEY` in .env. |
| **PDF** | WeasyPrint (R3) | Existing investment from PR5/PR8. |

---

## 3. Database Schema

### 3.1 Existing Tables (No Changes for R1)

These tables already exist and work for R1. No schema changes needed.

| Table | Purpose | Key Columns |
| --- | --- | --- |
| **site** | Physical location | id (UUID PK), name, tenant_id (FK, nullable), created_at |
| **upload** | CSV file ingestion | id (UUID PK), site_id (FK), file_name, uploaded_by, uploaded_at, parse_status, parse_outcome, report_type, rule_version_used, warnings (JSON string) |
| **reading** | Individual sensor readings | id (UUID PK), upload_id (FK), site_id (FK), device_id, zone_name, reading_timestamp, metric_name, metric_value, metric_unit, is_outlier, created_at |
| **finding** | Rule evaluation output | id (UUID PK), upload_id (FK), site_id (FK), zone_name, metric_name, metric_value, threshold_band, interpretation_text, workforce_impact_text, recommended_action, rule_id, rule_version, citation_unit_ids (JSON string), confidence_level, source_currency_status, benchmark_lane, created_at |
| **report** | Generated report | id (UUID PK), report_type, upload_id (FK, unique), site_id (FK), report_version, rule_version_used, citation_ids_used (JSON string), reviewer_name, reviewer_status, reviewer_approved_at, qa_checks (JSON string), data_quality_statement, certification_outcome, report_snapshot (JSON string), generated_at |

### 3.2 Workflow A Tables (No Changes)

| Table | Purpose | Key Columns |
| --- | --- | --- |
| **reference_source** | Standard document registry | id (UUID PK), title, publisher, source_type, jurisdiction, url, file_storage_key, checksum, version_label, published_date, effective_date, ingested_at, status, source_currency_status, source_completeness_status, last_verified_at |
| **citation_unit** | Verbatim excerpts from standards | id (UUID PK), source_id (FK), page_or_section, exact_excerpt, metric_tags (JSON string[]), condition_tags (JSON string[]), extracted_threshold_value, extracted_unit, extraction_confidence, extractor_version, needs_review |
| **rulebook_entry** | Runtime evaluation rules | id (UUID PK), metric_name, threshold_type, min_value, max_value, unit, context_scope, interpretation_template, business_impact_template, recommendation_template, priority_logic, index_weight_percent, confidence_level, rule_version, effective_from, effective_to, approval_status, approved_by, approved_at, citation_unit_ids (JSON string) |

### 3.3 Supporting Tables (No Changes for R1)

| Table | Purpose | Key Columns |
| --- | --- | --- |
| **tenant** | Customer organization | id (UUID PK), tenant_name, contact_email, certification_due_date, created_at, client_name (nullable), site_address (nullable), premises_type (nullable), contact_person (nullable), specific_event (nullable), comparative_analysis (bool) |
| **notification** | In-app notifications | id (UUID PK), user_id (nullable), tenant_id (nullable), type, title, body, is_read, created_at |

### 3.4 New Tables for R1/R2

#### site_metric_preferences

Stores per-site metric display preferences (PSD §6.2: "facility manager
chooses which metrics to display...preferences stored per-site").

| Column | Type | Constraints | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | PK | gen_random_uuid() | |
| site_id | UUID | FK → site.id, NOT NULL, UNIQUE | One row per site | |
| active_metrics | TEXT[] | NOT NULL | ARRAY[]::TEXT[] | Array of metric_name enum values to display |
| alert_threshold_overrides | JSONB | NOT NULL | '{}' | Per-metric threshold overrides: `{"co2_ppm": {"watch_max": 1100}}` |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**Why TEXT[] not JSONB for active_metrics**: PostgreSQL array type is
simpler for "list of enum values" queries and works well with SQLModel.
JSONB is overkill for a flat list.

**Why UNIQUE on site_id**: Each site has exactly one preference row. No need for a composite key.

#### site_standards

Stores which certification standards are active for each site (PSD §4: "selection at two levels: site level and scan level").

| Column | Type | Constraints | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | PK | gen_random_uuid() | |
| site_id | UUID | FK → site.id, NOT NULL | | |
| reference_source_id | UUID | FK → reference_source.id, NOT NULL | Which standard | |
| is_active | BOOLEAN | NOT NULL | true | |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**Unique constraint**: (site_id, reference_source_id) — a site can't have the same standard twice.

#### device_connection (R2)

Tracks uHoo device connectivity state for continuous monitoring (PSD §5.2, §6.4).

| Column | Type | Constraints | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | PK | gen_random_uuid() | |
| site_id | UUID | FK → site.id, NOT NULL | | |
| device_id | TEXT | NOT NULL | | uHoo device identifier |
| uhoo_api_key | TEXT | NOT NULL | | Encrypted API credential |
| polling_interval_seconds | INTEGER | NOT NULL | 600 | Default 10 min (range: 300-900) |
| last_poll_at | TIMESTAMPTZ | NULLABLE | | Last successful poll |
| last_heartbeat_at | TIMESTAMPTZ | NULLABLE | | Last device heartbeat |
| connection_status | TEXT | NOT NULL | 'offline' | 'online' \| 'offline' \| 'error' |
| error_message | TEXT | NULLABLE | | Last poll error |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**Unique constraint**: (site_id, device_id).

#### alert_log (R2)

Tracks sent alerts for deduplication (PSD §16.2: "4 hours between alerts for same metric in same zone").

| Column | Type | Constraints | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | PK | gen_random_uuid() | |
| site_id | UUID | FK → site.id, NOT NULL | | |
| zone_name | TEXT | NOT NULL | | |
| metric_name | TEXT | NOT NULL | Metric that triggered | |
| threshold_band | TEXT | NOT NULL | 'CRITICAL' at trigger time | |
| sent_at | TIMESTAMPTZ | NOT NULL | NOW() | When alert was sent |
| recipients | TEXT[] | NOT NULL | Email addresses that received it | |

**Index**: (site_id, zone_name, metric_name, sent_at DESC) — used to check "last alert for this metric/zone" for deduplication.

#### user_tenant (R1)

Maps Supabase Auth users to tenants (PSD §13.2: "Supabase Auth users linked to tenants via a user_tenant mapping table").

| Column | Type | Constraints | Default | Notes |
| --- | --- | --- | --- | --- |
| id | UUID | PK | gen_random_uuid() | |
| supabase_user_id | UUID | NOT NULL, UNIQUE | From Supabase Auth | |
| tenant_id | UUID | FK → tenant.id, NOT NULL | | |
| role | TEXT | NOT NULL | 'facility_manager' | 'facility_manager' \| 'admin' |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | |

**Unique constraint**: (supabase_user_id, tenant_id) — a user can manage multiple tenants.

### 3.5 Indexes (New)

| Table | Column(s) | Index Type | Purpose |
| --- | --- | --- | --- |
| site_metric_preferences | site_id | UNIQUE B-tree | Fast lookup by site |
| site_standards | (site_id, reference_source_id) | UNIQUE B-tree | Prevent duplicate standard assignments |
| device_connection | (site_id, device_id) | UNIQUE B-tree | Prevent duplicate device registrations |
| alert_log | (site_id, zone_name, metric_name, sent_at DESC) | B-tree | Deduplication query: "last alert for X" |
| user_tenant | (supabase_user_id, tenant_id) | UNIQUE B-tree | Fast tenant lookup for auth user |
| finding | (site_id, created_at) | Composite (existing) | Cross-site time-range queries |
| finding | (rule_version) | B-tree (existing) | Rule version filtering |

### 3.6 Schema Changes to Existing Tables

| Table | Change | Reason | Migration |
| --- | --- | --- | --- |
| **site** | Add `context_scope` TEXT DEFAULT 'general' | PSD §6.2: action recommendations vary by context (office, industrial, etc.) | 008_site_context |
| **site** | Add `standard_ids` TEXT[] DEFAULT '{}' | PSD §4: per-site standard preferences (shortcut to site_standards join) | 008_site_context |
| **upload** | Add `scan_type` TEXT DEFAULT 'adhoc' | PSD §5: track adhoc vs continuous data source | 009_scan_type |
| **upload** | Add `standards_evaluated` TEXT[] DEFAULT '{}' | PSD §6.3: which standards were evaluated during upload | 009_scan_type |
| **tenant** | No changes | Already has all needed columns from migration 007 | None |

---

## 4. API Contracts

### 4.1 Existing Endpoints (No Changes for R1)

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | /api/uploads | CSV upload + parse | None (R1) |
| GET | /api/uploads/{id} | Upload details | None (R1) |
| GET | /api/uploads/{id}/findings | Findings for upload | None (R1) |
| GET | /api/uploads/{id}/readings | Readings for chart | None (R1) |
| POST | /api/reports | Create draft report | None (R1) |
| GET | /api/reports | List reports | None (R1) |
| GET | /api/reports/{id} | Report details | None (R1) |
| GET | /api/dashboard/sites | Site summary cards | None (R1) |
| GET | /api/dashboard/sites/{id}/zones | Zone drilldown | None (R1) |
| GET | /api/dashboard/comparison | Cross-site leaderboard | None (R1) |
| GET | /api/dashboard/summary | Daily summary | None (R1) |
| GET | /api/dashboard/executive | Executive portfolio view | None (R1) |
| GET | /api/rulebook/rules | List rules | None |
| GET | /api/rulebook/rules/{id} | Rule details | None |
| GET | /api/rulebook/sources | List reference sources | None |
| GET | /api/notifications | List notifications | None (R1) |
| PATCH | /api/notifications/{id}/read | Mark read | None (R1) |

### 4.2 New Endpoints for R1

#### GET /api/sites/{id}/metric-preferences

**Request**: Path param `id` (site UUID)

**Response** (200):

```json
{
  "site_id": "uuid",
  "active_metrics": ["co2_ppm", "pm25_ugm3", "temperature_c"],
  "alert_threshold_overrides": {}
}
```

**Errors**: 404 if site not found.

#### PATCH /api/sites/{id}/metric-preferences

**Request**: Path param `id` (site UUID), Body:

```json
{
  "active_metrics": ["co2_ppm", "pm25_ugm3"],
  "alert_threshold_overrides": {
    "co2_ppm": {"watch_max": 1100.0}
  }
}
```

**Response** (200): Updated preferences object.

**Errors**: 400 if active_metrics contains invalid metric_name. 404 if site not found.

**Validation**:

- `active_metrics`: each value must be a valid MetricName enum value.
- `alert_threshold_overrides`: keys must be valid metric names; values must
  have numeric `watch_max`, `watch_min`, `critical_max`, or `critical_min`
  fields that fall within the rulebook's `min_value`/`max_value` bounds.

#### GET /api/sites/{id}/standards

**Request**: Path param `id` (site UUID)

**Response** (200):

```json
{
  "site_id": "uuid",
  "standards": [
    {"source_id": "uuid", "title": "SS554", "is_active": true},
    {"source_id": "uuid", "title": "SafeSpace", "is_active": false}
  ]
}
```

#### POST /api/sites/{id}/standards/{source_id}/activate

**Request**: Path params `id` (site UUID), `source_id` (reference_source UUID)

**Response** (204): No content.

**Errors**: 404 if site or source not found.

#### POST /api/sites/{id}/standards/{source_id}/deactivate

**Request**: Path params `id` (site UUID), `source_id` (reference_source UUID)

**Response** (204): No content.

#### GET /api/interpretations/{metric_name}/{threshold_band}

**Request**: Path params `metric_name` (enum), `threshold_band`
(GOOD|WATCH|CRITICAL). Query param `context_scope` (optional, default "general").

**Response** (200):

```json
{
  "metric_name": "co2_ppm",
  "threshold_band": "WATCH",
  "interpretation": "CO₂ levels indicate poor ventilation. Staff may feel drowsy and lose focus.",
  "business_impact": "Reduced cognitive performance. Estimated 5-10% productivity loss.",
  "recommendation": "Increase fresh air intake or open windows.",
  "context_scope": "general"
}
```

**Purpose**: PSD §7 "Human-readable interpretation layer" — maps threshold
bands to plain-language insights. This is the interpretation layer service.

#### POST /api/uploads (Enhanced for R1)

**Changes from existing**:

- Request body adds `standards` field (array of reference_source IDs to
  evaluate against). If omitted, defaults to site's configured standards
  (SS554 default).
- Response adds `standards_evaluated` field showing which standards were used.

**Request**: multipart/form-data with `file` (CSV) + `standards` (JSON array
of source IDs, optional) + `report_type` ("ASSESSMENT" |
"INTERVENTION_IMPACT", optional).

**Response** (201):

```json
{
  "upload_id": "uuid",
  "file_name": "scan.csv",
  "site_id": "uuid",
  "parse_status": "COMPLETE",
  "parse_outcome": "PASS",
  "report_type": "ASSESSMENT",
  "standards_evaluated": ["source-uuid-1", "source-uuid-2"],
  "row_count": 240,
  "finding_count": 15
}
```

**Errors**: 400 if file not CSV. 413 if file > 10 MB (PSD §17). 500 if parse fails.

#### GET /api/uploads/{id}/findings (Enhanced for R1)

**Changes from existing**:

- Response includes `standard_id` per finding so frontend can show per-standard results.
- Add query param `standard_id` (optional) to filter findings by standard.

**Response** (200):

```json
{
  "upload_id": "uuid",
  "findings": [
    {
      "id": "uuid",
      "zone_name": "Meeting Room A",
      "metric_name": "co2_ppm",
      "metric_value": 1200,
      "metric_unit": "ppm",
      "threshold_band": "CRITICAL",
      "interpretation_text": "CO₂ levels are elevated. Staff may feel drowsy.",
      "workforce_impact_text": "Reduced cognitive performance.",
      "recommended_action": "Increase ventilation.",
      "standard_id": "source-uuid",
      "standard_title": "SS554",
      "rule_version": "v1.0",
      "citation_unit_ids": ["citation-1", "citation-2"],
      "confidence_level": "HIGH",
      "source_currency_status": "CURRENT_VERIFIED"
    }
  ]
}
```

### 4.3 New Endpoints for R2

#### POST /api/devices

**Request**: Body:

```json
{
  "site_id": "uuid",
  "device_id": "uhoo-device-id",
  "uhoo_api_key": "encrypted-key",
  "polling_interval_seconds": 600
}
```

**Response** (201): Device connection object with `connection_status: "offline"`.

**Auth**: FJ Staff only (admin role).

#### POST /api/devices/{id}/test

**Request**: Path param `id` (device UUID)

**Response** (200): `{"status": "online", "last_heartbeat": "2026-04-23T14:00:00Z"}` or error.

**Purpose**: Test device connectivity and verify API key.

#### GET /api/devices

**Request**: Query param `site_id` (optional).

**Response** (200): List of device connections with status.

### 4.4 Rate Limiting

| Endpoint | Limit | Reason |
| --- | --- | --- |
| POST /api/uploads | 10 per minute per IP | PSD §14.3: prevents accidental duplicate uploads |
| All GET /api/dashboard/* | No limit (R1, internal only) | FJ staff laptop access |
| All GET /api/dashboard/* | 1 per 30 seconds per user (R2+) | PSD §14.3: continuous monitoring refresh |

---

## 5. Data Flow

### 5.1 Flow A: Adhoc Scan (CSV Upload → Dashboard)

```text
1. FJ staff uploads CSV via POST /api/uploads
   → Backend validates file type, size (< 10 MB)
   → Backend uploads to Supabase Storage (iaq-scans bucket)
   → Backend parses CSV (csv_parser.py)
     → Validates required columns
     → Rejects rows with missing timestamps or negative values (PSD §15.3)
     → Flags outliers per metric acceptable ranges (PSD §15.3)
   → Backend determines report type:
     → Single-day data → ASSESSMENT
     → Multi-day data → INTERVENTION_IMPACT
     → Or uses user-specified report_type
   → Backend evaluates against selected standards:
     → For each standard in request (or site defaults):
       → Query rulebook_entry for active rules of that standard
       → For each reading, find matching rule by metric_name
       → Classify into threshold_band (GOOD/WATCH/CRITICAL)
       → Generate Finding record with interpretation, impact, recommendation
   → Returns upload result with upload_id, parse_outcome, finding_count
   → Frontend redirects to findings tab with uploadId param

2. Frontend fetches GET /api/uploads/{id}/findings
   → Returns findings grouped by zone, per standard
   → Frontend renders:
     → Site overview card with wellness rating per standard
     → Zone detail with metric cards (value + interpretation + action)
     → Trend charts (TimeSeriesChart component, reused)

3. Optional: Frontend POST /api/reports
   → Creates draft report linked to upload
   → Returns report_id for later PDF generation (R3)
```

### 5.2 Flow B: Continuous Monitoring (R2)

```text
1. FJ staff configures device via POST /api/devices
   → Stores device_id, encrypted API key, polling interval
   → Initial status: "offline"

2. Backend polling service (scheduled task on Render):
   → For each active device:
     → If connection_status is "online":
       → Poll uHoo API for latest readings
       → Store readings in reading table
       → Evaluate against active standards for the site
       → Generate findings
       → If any finding is CRITICAL:
         → Check alert_log for deduplication (4-hour cooldown, PSD §16.2)
         → If cooldown passed: send email alert via Resend
         → Log alert in alert_log
     → If poll fails:
       → Set connection_status = "error"
       → Retry with backoff
     → If consecutive failures > 3:
       → Set connection_status = "offline"

3. Frontend auto-refreshes dashboard:
   → Polls GET /api/dashboard/sites every 30 seconds (PSD §17)
   → Updates wellness scores, status cards, trend charts
```

### 5.3 Wellness Index Calculation (Per-Standard)

```text
For each active standard on a site:
  1. Query rulebook_entry for rules of that standard with index_weight_percent > 0
  2. Query findings for the site, filtered by the standard's rules
  3. For each metric in the standard:
     → Map threshold_band to score: GOOD=100, WATCH=50, CRITICAL=0
     → Average score across all findings for that metric
     → Multiply by index_weight_percent / total_weight
  4. Sum weighted scores → wellness index (0-100)
  5. If no applicable rules: return 0.0, outcome = INSUFFICIENT_EVIDENCE

This ensures each standard produces its own independent score (PSD §4).
```

---

## 6. Infrastructure

### 6.1 Environment Variables

| Variable | Required | Environment | Secret | Description |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Dev, Prod | Yes | PostgreSQL connection string (app role — SELECT-only on Rulebook tables) |
| `ADMIN_DATABASE_URL` | Yes | Dev, Prod | Yes | Full-access DB role for Workflow A admin |
| `APPROVER_EMAIL` | Yes | Dev, Prod | No | Jay Choy's email — enforced by QA-G8 (R3) |
| `RESEND_API_KEY` | R2+ | Prod | Yes | Email dispatch (Resend) |
| `SUPABASE_URL` | Yes | Dev, Prod | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Dev, Prod | Yes | Supabase Storage service role key |
| `SUPABASE_STORAGE_BUCKET` | No | Dev, Prod | No | Storage bucket name (default: `iaq-scans`) |
| `SUPABASE_JWT_SECRET` | R1+ | Prod | Yes | For verifying Supabase Auth JWTs |
| `NEXT_PUBLIC_API_URL` | Yes | Dev, Prod | No | FastAPI backend base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | R1+ | Dev, Prod | No | Supabase Auth URL (frontend SDK) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | R1+ | Dev, Prod | No | Supabase Auth anon key (frontend SDK) |

### 6.2 Deployment

| Component | Target | Notes |
| --- | --- | --- |
| Frontend | Vercel | Next.js 15 App Router. Environment vars via Vercel dashboard. |
| Backend | Render | FastAPI. Dockerfile deployment. Environment vars via Render dashboard. |
| Database | Supabase (prod) / Docker Compose (local) | Supabase project: `jertvmbhgehajcrfifwl`. Local: PostgreSQL 16 on port 5432. |
| Storage | Supabase Storage | Bucket: `iaq-scans`. Service role key for uploads. |

### 6.3 Migration Strategy (PSD §13)

| Migration | Purpose | Risk | Reversible |
| --- | --- | --- | --- |
| **008_site_context** | Add `context_scope` and `standard_ids` to site table | Low — additive, nullable | Yes (DROP COLUMN) |
| **009_scan_type** | Add `scan_type` and `standards_evaluated` to upload table | Low — additive, with defaults | Yes (DROP COLUMN) |
| **010_site_metric_preferences** | Create site_metric_preferences table | Low — new table | Yes (DROP TABLE) |
| **011_site_standards** | Create site_standards table | Low — new table | Yes (DROP TABLE) |
| **012_device_connection** | Create device_connection table (R2) | Low — new table | Yes (DROP TABLE) |
| **013_alert_log** | Create alert_log table (R2) | Low — new table | Yes (DROP TABLE) |
| **014_user_tenant** | Create user_tenant table (R1) | Low — new table | Yes (DROP TABLE) |
| **Seed: default tenant** | Create "FJ Internal" tenant, assign existing sites | Low — idempotent script | Yes (delete tenant, revert site tenant_id to NULL) |
| **Seed: rulebook reorg** | Add SafeSpace/SS554 sources, reorganize rules by standard | Medium — modifies rule_version | Partially (can revert rule_version) |

### 6.4 CI/CD Pipeline

| Step | Tool | Trigger |
| --- | --- | --- |
| **Lint** | ruff (Python), ESLint (TypeScript) | PR, push to main |
| **Type check** | mypy (Python), tsc (TypeScript) | PR, push to main |
| **Backend tests** | pytest | PR, push to main |
| **Frontend tests** | Vitest | PR, push to main |
| **Build** | docker build (backend), next build (frontend) | PR, push to main |
| **Deploy** | Vercel auto-deploy (frontend), Render auto-deploy (backend) | Push to main |

---

## 7. Security

### 7.1 Authentication Strategy

| User Type | Auth Method | R1 Status |
| --- | --- | --- |
| **FJ Staff** | No auth (internal laptop access) | No auth barrier |
| **Facility Manager** | Supabase Auth (email + magic link) | JWT in Authorization header |

### 7.2 Tenant Isolation

**Implementation**: FastAPI dependency `get_current_tenant()` extracts
`tenant_id` from JWT claims. All facility-manager-facing routes require this
dependency.

**Enforcement layers**:

1. **API middleware** (primary): `TenantIdDep` dependency on all read routes.
   Already partially wired — dashboard routes already accept `tenant_id: TenantIdDep`.
2. **SQLModel queries** (secondary): WHERE clause on `tenant_id` for all tenant-scoped queries.
3. **Supabase RLS** (defense-in-depth): RLS policies on `site`, `reading`, `finding`, `report` tables.

**Admin bypass**: FJ staff routes bypass tenant filter (admin role has no tenant_id constraint).

### 7.3 Input Validation

| Input | Validation Rule | Error |
| --- | --- | --- |
| CSV file | Must be .csv, < 10 MB, has required columns | 400 / 413 |
| metric_value | Must be within acceptable ranges (PSD §15.3): CO₂ 300-5000, PM2.5 0-500, TVOC 0-10000, Temp 10-45, Humidity 10-95 | Flagged as outlier, not rejected |
| reading_timestamp | Must be valid ISO 8601 datetime | Row rejected with warning |
| alert_threshold_overrides | Must fall within rulebook min_value/max_value bounds | 400 if out of bounds |
| standards array | Each ID must exist in reference_source table | 400 if not found |

### 7.4 Secrets Management

| Secret | Storage | Rotation |
| --- | --- | --- |
| `DATABASE_URL` | Render env vars | Manual |
| `SUPABASE_SERVICE_ROLE_KEY` | Render env vars | Manual (Supabase dashboard) |
| `SUPABASE_JWT_SECRET` | Render env vars | Manual (Supabase dashboard) |
| `RESEND_API_KEY` | Render env vars | Manual (Resend dashboard) |
| `uhoo_api_key` (per device) | Encrypted in database (R2) | Manual (uHoo dashboard) |

---

## 8. Open Questions

| # | Question | Impact | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | uHoo API access confirmed available? | Blocks R2 (continuous monitoring) | Jay | TBD |
| 2 | SafeSpace thresholds — when will Jay/FJ team define them? | Affects whether SafeSpace shows as "Coming Soon" or active in R1 | Jay | TBD |
| 3 | SS554 certification document — when will it be loaded? | Affects whether SS554 shows actual thresholds or placeholder | Jay | TBD |
| 4 | Supabase Auth project — same as existing Supabase (`jertvmbhgehajcrfifwl`) or separate? | Affects JWT secret and frontend SDK config | Jeff | TBD |
| 5 | Email sender address for alerts (R2)? | Needs domain verification with Resend | Jay | TBD |
| 6 | How many facility managers expected in initial rollout? | Affects Supabase Auth billing tier | Jay | TBD |

---

## 9. Decision Log

| ID | Date | Decision | Rationale | Alternatives Considered |
| --- | --- | --- | --- | --- |
| D-R1-01 | 2026-04-23 | Dual evaluation path for rule engine | Wellness index must remain objective (standard-based) while allowing user-adjusted alert thresholds | Single evaluation path with overridden thresholds |
| D-R1-02 | 2026-04-23 | Metric preferences per-site, not per-user | Facility managers manage specific sites; preferences are site-contextual | Per-user preferences |
| D-R1-03 | 2026-04-23 | Configurable thresholds affect alerts only, not wellness index | Wellness index is an objective standard score; user overrides shouldn't affect it | User overrides affect both |
| D-R1-04 | 2026-04-23 | Cross-site comparison is admin-only | Tenant isolation prevents facility managers from seeing other tenants' data | Tenant-visible cross-site comparison |
| D-R1-05 | 2026-04-23 | Email alert deduplication: 4-hour cooldown per metric/zone | Prevents alert spam when metric stays in "Action Required" state | No deduplication, or longer cooldown |
| D-R1-06 | 2026-04-23 | PDF generation deferred to R3 | R1 delivers value with dashboard insights; PDFs are professional deliverables that need the insights first | PDF generation in R1 |
| D-R1-07 | 2026-04-23 | FJ staff has no auth barrier in R1 | Internal laptop access; speed of delivery | Auth for all users from R1 |
| D-R1-08 | 2026-04-23 | Delete old test suite (55 passed, 47 skipped) | Old tests covered compliance/QA model; new R1 tests will be built fresh | Archive old tests |
| D-R1-09 | 2026-04-23 | site_metric_preferences uses TEXT[] for active_metrics | Simpler for "list of enum values" queries; JSONB is overkill | JSONB for active_metrics |
| D-R1-10 | 2026-04-23 | site_standards as separate table, not array column on site | Supports future metadata per standard (activation date, configured_by, etc.) | Array of source IDs on site table |

---

## 10. Migration from Old Codebase (PSD §9)

### 10.1 What Stays

| Component | Status | Notes |
| --- | --- | --- |
| Upload pipeline (csv_parser, supabase_storage) | Keep | Reused for R1 |
| Rule engine (rule_engine.py) | Refactor | Add per-standard evaluation path |
| Wellness index (wellness_index.py) | Refactor | Add per-standard scoring |
| Dashboard endpoints | Keep | Already partially tenant-aware |
| TimeSeriesChart | Keep | Reusable chart component |
| Supabase schema | Keep | Minimal additions |

### 10.2 What Changes

| Component | Change | Phase |
| --- | --- | --- |
| Rule engine | Single unified → per-standard evaluation | R1 |
| Wellness index | Single score → per-standard score | R1 |
| Frontend | Compliance panel → human-friendly metric cards | R1 |
| Executive view | Compliance summary → "how's our space doing" with per-standard badges | R1 |
| Seed script | Add SS554 + SafeSpace, reorganize by standard | R1 |

### 10.3 What's Removed (Already Done)

| Component | Status | Notes |
| --- | --- | --- |
| QA gates (qa_gates.py) | Removed | Deferred to R3 |
| PDF orchestrator | Removed | Deferred to R3 |
| Report approval endpoints | Removed | Deferred to R3 |
| Compliance frontend components | Removed | Replaced by metric cards |
| Old test suite | Removed | New tests built for R1 |

### 10.4 What's Deferred

| Component | Phase | Notes |
| --- | --- | --- |
| uHoo API polling service | R2 | New component |
| Email alert system | R2 | New component |
| PDF report generation | R3 | Reuse WeasyPrint templates |
| QA gate system | R3 | Reinstated |
| Report approval workflow | R3 | Reinstated |
