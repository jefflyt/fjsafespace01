# FJDashboard — Supabase Schema Reference

> Source of truth for all tables in the Supabase Postgres project (`jertvmbhgehajcrfifwl`).
> Updated 2026-04-19. Bump this date when schema changes land.

---

## Workflow A — IAQ Rule Governance

These tables power the Reference Vault → Citation Units → Rulebook pipeline.
The dashboard (Workflow B) has **SELECT-only** access. Writes must use `ADMIN_DATABASE_URL`.

### `reference_source`

**What it is:** Registry of every external standard, guideline, whitepaper, or vendor spec referenced by the platform.
Examples include WHO AQG 2021 and SS 554:2018.

**When updated:** When a new standard is ingested or an existing one is superseded or retired.
Populated by the rulebook seed script or admin console.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `title` | TEXT | Human-readable name |
| `publisher` | TEXT | Issuing body |
| `source_type` | TEXT | `standard` \| `guideline` \| `whitepaper` \| `vendor` |
| `jurisdiction` | TEXT | Geographic or sector scope |
| `url` | TEXT | Link to published source |
| `file_storage_key` | TEXT | Supabase Storage key for uploaded PDF |
| `checksum` | TEXT | File integrity hash |
| `version_label` | TEXT | Publisher's version string |
| `published_date` | TIMESTAMPTZ | Date the source was published |
| `effective_date` | TIMESTAMPTZ | Date it becomes effective for our use |
| `ingested_at` | TIMESTAMPTZ | When it was loaded into the system |
| `status` | TEXT | `active` \| `superseded` \| `retired` |
| `source_currency_status` | TEXT | `CURRENT_VERIFIED` \| `PARTIAL_EXTRACT` \| `VERSION_UNVERIFIED` \| `SUPERSEDED` |
| `source_completeness_status` | TEXT | Optional completeness flag |
| `last_verified_at` | TIMESTAMPTZ | Last manual verification check |

### `citation_unit`

**What it is:** Individual clauses or paragraphs extracted from a reference source.
Each unit contains the verbatim excerpt and metadata about which metrics it applies to.

**When updated:** When a new standard is parsed and its clauses are extracted.
Always created alongside or after a `reference_source`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `source_id` | UUID | FK → `reference_source.id` |
| `page_or_section` | TEXT | Where in the source this clause lives |
| `exact_excerpt` | TEXT | Verbatim text from the source |
| `metric_tags` | TEXT | JSON string[] — which metrics this clause covers |
| `condition_tags` | TEXT | JSON string[] — contextual conditions |
| `extracted_threshold_value` | FLOAT | Numeric threshold if extractable |
| `extracted_unit` | TEXT | Unit of the threshold |
| `extraction_confidence` | FLOAT | 0–1 confidence in automated extraction |
| `extractor_version` | TEXT | Version of the extraction tool |
| `needs_review` | BOOL | Default `TRUE` — flags for human review |

### `rulebook_entry`

**What it is:** The runtime source of truth for IAQ thresholds, certification logic, and Wellness Index weights.
Dashboard services read this table to evaluate findings.

**When updated:** When thresholds change — the old entry is marked `superseded` with an `effective_to` date.
A new entry is created with an incremented `rule_version`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `metric_name` | TEXT | `co2_ppm` \| `pm25_ugm3` \| `tvoc_ppb` \| `temperature_c` \| `humidity_rh` |
| `threshold_type` | TEXT | `range` \| `upper_bound` \| `lower_bound` |
| `min_value` | FLOAT | Lower bound |
| `max_value` | FLOAT | Upper bound |
| `unit` | TEXT | Unit string |
| `context_scope` | TEXT | `office` \| `industrial` \| `school` \| `residential` \| `general` |
| `interpretation_template` | TEXT | Jinja2 template for finding text |
| `business_impact_template` | TEXT | Jinja2 template for workforce impact |
| `recommendation_template` | TEXT | Jinja2 template for recommended action |
| `priority` | TEXT | `P1` \| `P2` \| `P3` |
| `index_weight_percent` | FLOAT | Wellness Index weight % |
| `confidence_level` | TEXT | `HIGH` \| `MEDIUM` \| `LOW` |
| `rule_version` | TEXT | Semantic version string |
| `effective_from` | TIMESTAMPTZ | When this rule becomes active |
| `effective_to` | TIMESTAMPTZ | When it was superseded (nullable) |
| `approval_status` | TEXT | `draft` \| `approved` \| `superseded` |
| `approved_by` | TEXT | Admin who approved |
| `approved_at` | TIMESTAMPTZ | Approval timestamp |
| `citation_unit_ids` | TEXT | Comma-separated IDs linking to `citation_unit` |

---

## Supporting Tables

### `tenant`

**What it is:** Multi-tenant customer profile. Used in R1+ for tenant
isolation and customer management. Created during CSV upload with customer
info, linked to sites.

**When updated:** Created when a new customer uploads data (auto-created
from upload form fields). Sites reference tenants via `tenant_id` FK.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `tenant_name` | TEXT | Customer name (defaults to `client_name`) |
| `contact_email` | TEXT | Primary contact |
| `certification_due_date` | TIMESTAMPTZ | Renewal deadline |
| `client_name` | TEXT | Nullable — client organization name |
| `site_address` | TEXT | Nullable — physical address |
| `premises_type` | TEXT | Nullable — office, industrial, etc. |
| `contact_person` | TEXT | Nullable — primary contact name |
| `specific_event` | TEXT | Nullable — event context for scan |
| `comparative_analysis` | BOOL | Whether this is a before/after scan |
| `created_at` | TIMESTAMPTZ | Onboarding timestamp |

### `notification`

**What it is:** In-app notifications for the ops team.
Frontend polls `GET /api/notifications` every 60 seconds. Phase 3 also triggers Resend emails for `renewal_due` events.

**When updated:** Automatically when events occur — new alerts, overdue reports, approved reports, upcoming renewals.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | TEXT | Nullable — null means broadcast to ops team |
| `tenant_id` | UUID | FK → `tenant.id` (nullable for Phase 1/2) |
| `type` | TEXT | `alert_new` \| `alert_overdue` \| `report_approved` \| `renewal_due` |
| `title` | TEXT | Notification title |
| `body` | TEXT | Notification body |
| `is_read` | BOOL | Default `FALSE` |
| `created_at` | TIMESTAMPTZ | When the notification was created |

---

## Workflow B — Scan-to-Report Operations

These tables form the core operational pipeline: Upload → Readings → Findings → Report.

### `site`

**What it is:** A physical location being monitored for IAQ (e.g. "New Park Estate Office", "Changi Airport Terminal 2").

**When updated:** When a new monitoring location is registered. Rarely changed after creation.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `name` | TEXT | Human-readable site name |
| `tenant_id` | UUID | FK → `tenant.id` |
| `context_scope` | TEXT | `office` \| `industrial` \| `school` \| `residential` \| `general`. Default `general`. |
| `standard_ids` | TEXT | JSON string[] — shortcut to site_standards join |
| `created_at` | TIMESTAMPTZ | Registration timestamp |

### `upload`

**What it is:** A single CSV file upload from a site sensor. Tracks the parse lifecycle and auto-detected report type.

**When updated:** Created when a CSV is uploaded.
`parse_status` and `parse_outcome` are updated during the synchronous parse → evaluate pipeline.
`report_type` is auto-detected during upload (single day = `ASSESSMENT`, multi-day = `INTERVENTION_IMPACT`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `site_id` | UUID | FK → `site.id` |
| `file_name` | TEXT | Original CSV filename |
| `uploaded_by` | TEXT | Analyst identifier |
| `uploaded_at` | TIMESTAMPTZ | Upload timestamp |
| `parse_status` | TEXT | `PENDING` \| `PROCESSING` \| `COMPLETE` \| `FAILED` |
| `parse_outcome` | TEXT | `PASS` \| `PASS_WITH_WARNINGS` \| `FAIL` |
| `report_type` | TEXT | `ASSESSMENT` \| `INTERVENTION_IMPACT` (auto-detected) |
| `rule_version_used` | TEXT | Rulebook version at time of evaluation |
| `warnings` | TEXT | JSON string[] of parse warnings |
| `scan_type` | TEXT | `adhoc` \| `continuous`. Default `adhoc`. |
| `standards_evaluated` | TEXT | JSON string[] — reference_source IDs used during evaluation |

### `reading`

**What it is:** Individual sensor data rows parsed from an uploaded CSV. Each row is one metric reading at one timestamp.

**When updated:** Bulk-inserted during CSV parsing. Never modified after parse — readings are immutable raw data.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `upload_id` | UUID | FK → `upload.id` |
| `site_id` | UUID | FK → `site.id` |
| `device_id` | TEXT | Sensor identifier |
| `reading_timestamp` | TIMESTAMPTZ | When the reading was taken |
| `metric_name` | TEXT | `co2_ppm` \| `pm25_ugm3` \| `tvoc_ppb` \| `temperature_c` \| `humidity_rh` |
| `metric_value` | FLOAT | Measured value |
| `metric_unit` | TEXT | Unit string |
| `is_outlier` | BOOL | Default `FALSE` |
| `created_at` | TIMESTAMPTZ | Insert timestamp |

### `finding`

**What it is:** The output of rule evaluation for a single metric reading.
Each finding compares a reading against the rulebook.
It determines the threshold band, interpretation, and recommended action.

**When updated:** Bulk-inserted during the rule evaluation step (immediately after parse completes).
Never modified — findings are the authoritative record of what the rules said at that point in time.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `upload_id` | UUID | FK → `upload.id` |
| `site_id` | UUID | FK → `site.id` |
| `zone_name` | TEXT | Zone within the site (e.g. "Lobby", "Office A") |
| `metric_name` | TEXT | Which metric was evaluated |
| `threshold_band` | TEXT | `GOOD` \| `WATCH` \| `CRITICAL` |
| `interpretation_text` | TEXT | Human-readable interpretation |
| `workforce_impact_text` | TEXT | Impact description for workers |
| `recommended_action` | TEXT | Suggested remediation |
| `rule_id` | UUID | Which rulebook entry was matched |
| `rule_version` | TEXT | Rule version at evaluation time |
| `citation_unit_ids` | TEXT | JSON string[] — source citations for traceability |
| `confidence_level` | TEXT | `HIGH` \| `MEDIUM` \| `LOW` |
| `source_currency_status` | TEXT | Status of the rule's source |
| `benchmark_lane` | TEXT | `FJ_SAFESPACE` |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `report`

**What it is:** The final report generated from an upload's findings.
It contains QA checklist state, certification outcome, and an immutable HTML snapshot.
The snapshot is captured at approval time for reproducible PDF generation.

**When updated:** Created as a draft after upload evaluation.
Updated incrementally as the analyst works through the QA checklist.
Final update happens on approval.
The `report_snapshot` is populated with rendered HTML and `reviewer_status` transitions to `APPROVED`.
After approval, only `reviewer_status` can change to `EXPORTED`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `report_type` | TEXT | `ASSESSMENT` \| `INTERVENTION_IMPACT` |
| `upload_id` | UUID | FK → `upload.id` (unique — one report per upload) |
| `site_id` | UUID | FK → `site.id` |
| `report_version` | INT | Default `1` |
| `rule_version_used` | TEXT | Rulebook version at generation |
| `citation_ids_used` | TEXT | JSON string[] of citation IDs |
| `reviewer_name` | TEXT | Analyst name |
| `reviewer_status` | TEXT | `DRAFT_GENERATED` \| `IN_REVIEW` \| `REVISION_REQUIRED` \| `APPROVED` \| `EXPORTED` |
| `reviewer_approved_at` | TIMESTAMPTZ | When the report was approved |
| `qa_checks` | TEXT | JSON dict `{gate_id: bool}` — QA checklist state |
| `data_quality_statement` | TEXT | Free-text quality note |
| `certification_outcome` | TEXT | `HEALTHY_WORKPLACE_CERTIFIED` \| `HEALTHY_SPACE_VERIFIED` \| `IMPROVEMENT_RECOMMENDED` \| `INSUFFICIENT_EVIDENCE` |
| `report_snapshot` | TEXT | Immutable JSON `{html, context, template}` — captured at approval |
| `generated_at` | TIMESTAMPTZ | Report creation timestamp |

---

## New Tables (R1/R2 Refactor)

### `site_metric_preferences`

**What it is:** Per-site metric display preferences. One row per site.
Facility managers choose which metrics to show and can adjust alert
thresholds within safe bounds.

**When updated:** When a facility manager changes metric visibility or alert threshold overrides for their site.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `site_id` | UUID | FK → `site.id`, UNIQUE — one row per site |
| `active_metrics` | TEXT[] | Array of metric names to display (e.g., `ARRAY['co2_ppm', 'pm25_ugm3']`) |
| `alert_threshold_overrides` | JSONB | Per-metric threshold overrides: `{"co2_ppm": {"watch_max": 1100}}` |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

### `site_standards`

**What it is:** Maps sites to certification standards (WELL, ASHRAE, SS554,
SafeSpace). A site can have multiple active standards, each judged
independently.

**When updated:** When FJ staff adds or removes a standard from a site during setup.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `site_id` | UUID | FK → `site.id` |
| `reference_source_id` | UUID | FK → `reference_source.id` |
| `is_active` | BOOL | Default `TRUE` |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Unique constraint:** `(site_id, reference_source_id)` — a site can't have
the same standard twice.

### `user_tenant`

**What it is:** Maps Supabase Auth users to tenants for tenant isolation.
Enables facility managers to log in and see only their own sites.

**When updated:** When a facility manager account is created or assigned to a tenant.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `supabase_user_id` | UUID | UNIQUE — from Supabase Auth |
| `tenant_id` | UUID | FK → `tenant.id` |
| `role` | TEXT | `facility_manager` \| `admin` |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

### `device_connection` (R2)

**What it is:** Tracks uHoo device connectivity state for continuous monitoring.
Stores encrypted API credentials and polling configuration.

**When updated:** When a device is registered, polled, or loses connection.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `site_id` | UUID | FK → `site.id` |
| `device_id` | TEXT | uHoo device identifier |
| `uhoo_api_key` | TEXT | Encrypted API credential |
| `polling_interval_seconds` | INTEGER | Default `600` (10 min, range: 300–900) |
| `last_poll_at` | TIMESTAMPTZ | Nullable — last successful poll |
| `last_heartbeat_at` | TIMESTAMPTZ | Nullable — last device heartbeat |
| `connection_status` | TEXT | `online` \| `offline` \| `error` |
| `error_message` | TEXT | Nullable — last poll error |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

**Unique constraint:** `(site_id, device_id)`.

### `alert_log` (R2)

**What it is:** Tracks sent alerts for deduplication.
Prevents repeated alerts for the same metric/zone within a 4-hour cooldown window.

**When updated:** Every time an email alert is sent.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `site_id` | UUID | FK → `site.id` |
| `zone_name` | TEXT | Zone name |
| `metric_name` | TEXT | Metric that triggered the alert |
| `threshold_band` | TEXT | `'CRITICAL'` at trigger time |
| `sent_at` | TIMESTAMPTZ | Default `NOW()` |
| `recipients` | TEXT[] | Email addresses that received it |

**Index:** `(site_id, zone_name, metric_name, sent_at DESC)` — used for deduplication queries.

---

## Legacy Table

### `rulebook`

**What it is:** Legacy flat-structure table from early development.
Stores rules as a single JSONB blob per source.
**Not used by the current pipeline** — the new flow uses `reference_source` → `citation_unit` → `rulebook_entry`.

**Status:** Can be dropped once migration to the new tables is confirmed working. Keep for now as backup reference.

---

## Data Flow Summary

```text
reference_source ──┐
                   ├──► citation_unit ──┐
                   └────────────────────┴──► rulebook_entry
                                                    │
                                                    │  (SELECT-only by dashboard)
                                                    ▼
site ──► upload ──► reading ──► finding ◄───────────┘
                      │
                      ▼
                   report ──► report_snapshot (at approval)
                      │
                      ▼
                   PDF (generated on-demand from snapshot HTML)
```

## Indexes

| Table | Index | Purpose |
| --- | --- | --- |
| `citation_unit` | `ix_citation_unit_source_id` | Look up clauses by source |
| `rulebook_entry` | `ix_rulebook_entry_metric` | Filter by metric |
| `rulebook_entry` | `ix_rulebook_entry_version` | Filter by rule version |
| `rulebook_entry` | `ix_rulebook_entry_approval` | Filter by approval status |
| `notification` | `ix_notification_user_id` | Fetch user's notifications |
| `notification` | `ix_notification_created_at` | Order by recency |
| `upload` | `ix_upload_site_id` | List uploads per site |
| `upload` | `ix_upload_uploaded_at` | Order by upload time |
| `upload` | `ix_upload_parse_status` | Filter by parse state |
| `reading` | `ix_reading_upload_id` | Fetch readings for an upload |
| `reading` | `ix_reading_site_id` | Aggregate readings per site |
| `reading` | `ix_reading_timestamp` | Time-series queries |
| `finding` | `ix_finding_upload_id` | Fetch findings for an upload |
| `finding` | `ix_finding_site_id` | Cross-site comparison |
| `finding` | `ix_finding_created_at` | Time-based filtering |
| `finding` | `ix_finding_rule_version` | Audit by rule version |
| `finding` | `ix_finding_site_created` | Site + time range queries |
| `report` | `ix_report_site_id` | Reports per site |
| `report` | `ix_report_generated_at` | Reports by date |
| `report` | `ix_report_status` | Filter by review status |
