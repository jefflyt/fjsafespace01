FJ SafeSpace - FJDashboard Product Specification Document (PSD-02) v0.1
Scope: Dashboard Layer — Phase 1 (Analyst View) + Phase 2 (Internal Dashboard) + Phase 3 (Customer Portal)
Date: 2026-04-11
Owner: Jeff
PM: Lyra
Status: Draft for Review
Parent PRD: FJDashboard PRD v1.1
Parent PSD: PSD-01 v0.3 (Upload + Findings + Report)

0. Document Control

Purpose: Provide build-ready implementation detail for the FJDashboard product layer across all three phases.
Source of truth: This document governs dashboard scope, data contracts, service boundaries, view specifications, and acceptance criteria.
Parent documents: FJDashboard PRD v1.1 (product requirements) and PSD-01 v0.3 (Phase 1 pipeline specification).
Change control: Any change to dashboard schema, service boundaries, view layout rules, or QA gates requires a version bump and decision-log entry in FJDashboard PRD.
Approval authority: Jay Choy — final approver for rule changes, report release, and certification outcomes.
Legal gate: Phase 3 customer portal go-live is blocked until legal/medical disclaimer wording is approved.


1. Objective

Deliver the dashboard layer of FJ SafeSpace that converts approved, rule-based findings into role-appropriate, traceable, and actionable views for internal operators, executives, and (in Phase 3) customers.

The dashboard does not generate findings or set thresholds. It reads from the Rulebook runtime API (approved outputs only) and presents data through role-gated views.

Phases covered by this document:
- Phase 1: Analyst view enhancements — upload queue visibility, findings panel, report status tracking.
- Phase 2: Internal dashboard — Executive Overview, Operations Alert Queue, Intervention Tracker, Cross-Site Comparison, Zone/Floor Drilldown.
- Phase 3: Customer portal — certification status view, corrective action tracker, renewal workflow.


2. Scope Boundaries

In Scope
- Role-based dashboard views: Executive, Operations, Analyst, Customer (Phase 3)
- Dashboard read layer consuming Rulebook runtime API
- Alert Center with owner assignment, due date, and audit trail
- Intervention Tracker with before/after snapshots and confidence labels
- Cross-site comparison ranked by P1/P2/P3 breach count
- Daily summary card (top 3 risks, top 3 actions, next verification date)
- Report version history and status tracking
- Trend visualisation per parameter (pre/post intervention)
- Source currency status badges on all certification-related views
- In-app and email notifications for alerts and renewal reminders
- Customer portal: certification status, corrective action view, renewal prompt (Phase 3)

Out of Scope
- Findings generation or threshold setting (governed by PSD-01 and Rulebook governance workflow)
- Any path for manual threshold override — this is permanently disabled at service level
- Customer self-service report editing
- BMS/IoT control automation
- Live uHoo API ingestion before Phase 3 API feasibility sprint is complete
- Slack or any notification channel other than in-app and email (locked)
- Composite IAQ score — cross-site ranking uses breach count only (locked)


3. End-to-End Workflow

3.1 Phase 1 Workflow (Analyst View)

Upload -> Parse + Validate (PSD-01) -> Rule Evaluation (PSD-01) ->
Findings Stored -> Dashboard Analyst View reads approved findings ->
Displays: upload queue status | findings panel | citation badges | report status | QA checklist gate

3.2 Phase 2 Workflow (Internal Dashboard)

Approved Findings (from Phase 1 pipeline) ->
Dashboard Aggregation Service ->
  -> Executive View: Space Health Rating | top risks | top actions | next verification date
  -> Operations View: Alert Queue | Intervention Tracker | Cross-Site Comparison | Zone Drilldown
  -> Analyst View: upload queue | findings panel | report draft builder
Alert and Action Service -> in-app + email notifications -> closure audit trail
Intervention Tracking Service -> before/after reading pairs -> trend delta cards

3.3 Phase 3 Workflow (Customer Portal)

Approved Report + Certification Outcome ->
Tenant-Isolated Customer View ->
  -> Space Health Rating status | corrective action tracker (read-only) | renewal date | disclaimer
Renewal Trigger -> in-app + email notification -> recertification workflow prompt


4. Dashboard Data Contract (Schema v1)

4.1 New Fields (extending PSD-01 data model)

Field                    Type            Required    Values / Constraints
dashboard_role_view      enum            Yes         executive | ops | analyst | customer
alert_priority           enum            Yes         P1 | P2 | P3
action_owner             string          Conditional Required for P1 and P2 alerts; nullable for P3
action_due_date          ISO8601 date    Conditional Required for P1 and P2 alerts; nullable for P3
alert_closure_status     enum            Yes         open | in_progress | resolved | overdue
alert_closure_timestamp  ISO8601         Conditional Populated on closure; null if open
intervention_id          UUID            Yes         Unique per intervention record
baseline_window_start    ISO8601         Yes         Start of pre-intervention reading window
baseline_window_end      ISO8601         Yes         End of pre-intervention reading window
post_window_start        ISO8601         Yes         Start of post-intervention reading window
post_window_end          ISO8601         Yes         End of post-intervention reading window
causality_confidence     enum            Yes         high | medium | low
confounder_notes         text            Optional    Analyst-editable pre-sign-off; audit-locked post-reviewer approval
confounder_edit_history  JSON array      System      [{editor, timestamp, previous_value}] — auto-logged
data_quality_score       float 0.0–1.0   Yes         Composite of uptime_ratio and outlier_rate
uptime_ratio             float 0.0–1.0   Yes         Proportion of expected readings received in window
outlier_rate             float 0.0–1.0   Yes         Proportion of readings flagged as implausible outliers
source_currency_status   enum            Yes         Current Verified | Partial Extract | Version Unverified | Superseded
space_health_rating      string          Derived     Display label — value is always "Space Health Rating" (locked)
certification_outcome    enum            Yes         Pass | Conditional | Fail | Insufficient Evidence
benchmark_lane           enum            Yes         SS554 | BCA | WELL | None
days_open                integer         Derived     Calculated from alert creation timestamp to current date
tenant_id                UUID            Yes (Ph3)   Required for Phase 3 customer portal; null for Phase 1/2

4.2 Inherited Fields (from PSD-01)

All fields from PSD-01 §4 (site_name, zone_name, device_id, reading_timestamp, metric_name,
metric_value, metric_unit) and report metadata (report_id, generated_at, rules_version,
reviewer_name, reviewer_status) remain unchanged and are consumed by dashboard services.

4.3 Validation Rules

- If alert_priority is P1 or P2: action_owner and action_due_date must not be null.
- If causality_confidence is provided: confounder_notes field is enabled for analyst editing.
- data_quality_score must be computable before dashboard card renders; if not computable, card shows "Data Quality: Unavailable" with reason.
- source_currency_status must be present on every certification-impact finding; absence blocks dashboard render for that finding.
- tenant_id is mandatory in Phase 3; any customer-role request without a valid tenant_id returns 403.


5. Service Architecture

The dashboard layer introduces three new services. All consume the Rulebook runtime API in read-only mode. No service in the dashboard layer may write to or mutate the Rulebook.

5.1 Dashboard Aggregation Service

Purpose: Compute and serve site/zone summary cards for all role views.

Inputs:
- Approved findings (from Rule Evaluation Service, PSD-01 §21.2)
- Rulebook runtime API (rule_version, citation_unit_ids, benchmark_lane)
- Site metadata (site_name, zone_name, device_id)

Outputs:
- Site summary card: {site_name, certification_outcome, space_health_rating, top_3_risks[], top_3_actions[], next_verification_date, last_scan_date}
- Zone drilldown card: {zone_name, metric_readings[], threshold_band[], source_currency_status[], trend_sparkline_data[]}
- Cross-site comparison row: {site_name, P1_count, P2_count, P3_count} — sorted P1 descending, P2 secondary

Runtime integrity constraints:
- Every finding served must include rule_version + citation_id; any finding missing these fields is rejected from dashboard output.
- If certification_outcome cannot be determined due to missing applicable rules, service must return Insufficient Evidence — never null or a default pass value.
- Threshold mutation requests are rejected at service boundary (HTTP 403).

5.2 Alert and Action Service

Purpose: Manage the alert lifecycle from finding creation to closure, including notification dispatch.

Inputs:
- Findings with alert_priority, action_owner, action_due_date (from Aggregation Service)
- Closure events (operator action)

Outputs:
- Alert queue: filterable, sortable list of all open alerts across sites
- Audit trail per alert: [{event_type, actor, timestamp, note}]
- Notification events: in-app and email (no other channels)

Notification triggers:
- New P1 alert created -> immediate in-app + email to action_owner and operations manager
- P1/P2 alert overdue (past action_due_date) -> daily reminder in-app + email
- Renewal due within 30 days (Phase 3) -> in-app + email to customer and internal ops

State machine:
open -> in_progress (owner acknowledges) -> resolved (owner closes with note) | overdue (system, past due date)
overdue -> resolved (owner closes with note, late flag preserved in audit trail)

5.3 Intervention Tracking Service

Purpose: Record, store, and serve before/after IAQ comparison data for interventions.

Inputs:
- baseline_window (start, end) and post_window (start, end) — analyst-defined
- Readings from both windows (from site reading store)
- causality_confidence (analyst-assigned)
- confounder_notes (analyst-editable; locked after reviewer sign-off)
- intervention_id (system-generated UUID)

Outputs:
- Intervention card: {metric, baseline_avg, post_avg, delta, delta_pct, causality_confidence, confounder_notes, confidence_label, rule_citation}
- Trend delta visualisation data: time-series of metric values across both windows

Edit lock rules:
- confounder_notes is editable by analyst role while report status is in draft_generated or in_review.
- On reviewer approval (status -> approved), confounder_notes becomes read-only.
- All edits are logged to confounder_edit_history: [{editor_id, timestamp, previous_value, new_value}].
- confounder_edit_history is immutable — no deletion permitted.


6. View Specifications

6.1 Executive View

Available from: Phase 2

Layout (top to bottom):
1. Page header: site selector (multi-select for cross-site) + date range picker
2. Space Health Rating status card per site: certification_outcome chip (colour-coded) + last_scan_date
3. Top 3 Risks panel: P1 findings, metric name, zone, benchmark lane exceeded
4. Top 3 Actions panel: action text, owner, due date, priority chip
5. Next Verification Date badge

Colour coding:
Pass                 -> Green
Conditional          -> Amber
Fail                 -> Red
Insufficient Evidence -> Grey (with tooltip: "Insufficient rule coverage for this context")

Load priority rule: risks and actions must render before charts or secondary data.
Comprehension target: executive stakeholder identifies top risks and required actions in <=5 minutes.
Empty state: "No findings available — upload required" with link to upload page.

6.2 Operations View

Available from: Phase 2

Layout:
A) Alert Center table
   Columns: Site | Zone | Parameter | Current Value | Benchmark Lane | Status | Owner | Due Date | Days Open | Actions
   Default sort: P1 first, then Days Open descending
   Filters: priority, site, zone, parameter, status, owner
   Row action: Assign owner | Set due date | Close (requires closure note) | View audit trail

B) Cross-Site Comparison table
   Columns: Site | P1 Breaches | P2 Breaches | P3 Breaches | Last Scan | Certification Outcome
   Sort: P1 descending (primary), P2 descending (secondary)
   No composite score column — breach counts only (locked, OQ4)

C) Zone/Floor Drilldown
   Triggered by: click on site row in comparison table or site card
   Shows: per-zone metric readings, threshold band status, source currency badge, trend sparkline
   Source currency badge colours:
     Current Verified      -> Green
     Partial Extract       -> Amber + "Advisory Only" tag
     Version Unverified    -> Amber + "Advisory Only" tag
     Superseded            -> Red + "Superseded — not valid for certification" tag

D) Intervention Tracker
   Card format per intervention:
     Metric | Baseline (window + avg) | Post (window + avg) | Delta | Delta% | Confidence Label | Confounder Notes (toggle)
   Confounder notes visible via expand toggle; shows edit history if reviewer-locked.

6.3 Analyst View

Available from: Phase 1

Layout:
A) Upload Queue table
   Columns: File | Site | Upload Timestamp | Status | Parse Outcome | Actions
   Status values: pending | processing | complete | failed
   Parse Outcome: PASS | PASS_WITH_WARNINGS | FAIL (from PSD-01 §6)
   Row action: view parse log | retry (if failed) | proceed to findings

B) Findings Panel (per upload / assessment)
   Per metric row: Metric Name | Current Value | Unit | Threshold Band | Rule Interpretation | Citation Badge | Confidence | Action Priority
   Citation Badge: clickable -> shows citation_unit_id, source title, source_currency_status, rule_version
   Source currency badge follows same colour coding as Operations View.

C) Report Draft Builder
   Report status chip: draft_generated | in_review | revision_required | approved | exported
   QA checklist gate: approval action button disabled until all checklist items are confirmed.
   QA checklist items (per PSD-01 §11 + Dashboard additions):
     [ ] All P1/P2 findings have action_owner and action_due_date
     [ ] All non-obvious findings have citation_id
     [ ] All citation sources are Current Verified (or advisory label confirmed)
     [ ] Causality confidence note present for all intervention-impact claims
     [ ] Data quality statement present
     [ ] Disclaimer block confirmed
     [ ] Reviewer identity confirmed (Jay Choy only for certification outcomes)

6.4 Customer Portal View

Available from: Phase 3

Layout:
1. Legal/medical disclaimer banner (always visible, top of page, approved wording required)
2. Space Health Rating card: certification_outcome | site_name | assessment_date | next_renewal_date
3. Corrective Action tracker: read-only list of P1/P2 actions with status, due date, last updated
4. Renewal prompt: "Your certification is due for renewal on [date]. Contact FJ SafeSpace to schedule."
5. Tenant scoping: customer sees only their own tenant_id-scoped sites — no cross-tenant data exposure.

Customer cannot: edit findings, modify thresholds, change certification outcome, or access raw readings.
Insufficient Evidence: displayed as "Space Health Rating: Insufficient Data — additional assessment required."


7. Rule-Evaluation Integration Constraints

These constraints apply to all dashboard services. They mirror PSD-01 §21.3 and §23 and must not be weakened.

- All dashboard modules consume approved Rulebook runtime API only. Direct database reads bypassing the API are not permitted.
- Any module request that produces a finding without rule_version + citation_id fails validation and is rejected from the dashboard output.
- Benchmark lane must be explicit per metric: SS554 as baseline; BCA and WELL as overlays where applicable.
- Insufficient Evidence must be returned and displayed when no valid applicable rule set exists for a context/metric. It must never be silently dropped, defaulted to Pass, or hidden from the user.
- Rules derived from Partial Extract or Version Unverified sources are advisory only. Dashboard must display an explicit advisory warning label. These rules cannot produce a certification Pass, Conditional, or Fail outcome.
- No manual threshold override path exists in any dashboard service. Any such request returns HTTP 403.
- Source currency status field must be populated on every certification-impact finding displayed in the dashboard. Absence of this field blocks render for that finding.


8. Non-Functional Requirements

NFR-D1  Reproducibility:     Same input + same rule_version always produces the same dashboard output.
NFR-D2  Traceability:        Every metric card, finding, and alert includes rule_version and citation_id.
NFR-D3  Performance:         Dashboard page load < 3 seconds for all views (target, standard network).
NFR-D4  Report generation:   Report draft generation < 2 minutes (from PSD-01 §13; applies to dashboard trigger).
NFR-D5  Upload-to-dashboard: Findings available in dashboard within < 2 hours of analyst upload (Phase 2 target).
NFR-D6  Security Ph1/Ph2:    Internal-only access; no unauthenticated endpoints.
NFR-D7  Security Ph3:        Role-based authentication required; tenant data strictly isolated by tenant_id.
NFR-D8  Availability Ph3:    99.5% uptime at Phase 3 launch (planned maintenance windows excluded).
                              Roadmap to 99.9% post-stabilisation; 12-month review trigger. (Locked, OQ5)
NFR-D9  Audit logging:       confounder_edit_history immutable; alert closure audit trail immutable.
NFR-D10 Accessibility:       Executive view must be comprehensible by a non-technical stakeholder within 5 minutes.


9. QA Gate Enhancements

A dashboard view render or report release fails if any of the following is true:

Gate                      Condition that triggers failure
QA-G1                     action_owner is null for any P1 or P2 alert
QA-G2                     action_due_date is null for any P1 or P2 alert
QA-G3                     causality_confidence is absent for any intervention-impact claim
QA-G4                     data_quality_score or data quality statement is absent from report
QA-G5                     rule_version or citation_id is absent from any certification-impact finding
QA-G6                     source_currency_status is non-Current-Verified for a certification-path finding without advisory warning label
QA-G7                     Insufficient Evidence state is absent from UI when no valid rule set applies
QA-G8                     Reviewer identity is not Jay Choy for report state transition to approved (certification outcomes)
QA-G9                     (Phase 3) tenant_id is absent or mismatched for any customer-role data request


10. Acceptance Criteria

10.1 Phase 1 Gate (Phase 1 -> Phase 2 unlock)

AC-D1   FR-D1 to FR-D7 all implemented and verified on test dataset.
AC-D2   Analyst view page load < 3 seconds on standard network.
AC-D3   Citation badge visible and correct on all findings in test dataset.
AC-D4   QA checklist gate blocks report approval when any citation is missing (test case verified).
AC-D5   Findings panel shows rule_version on every row; no finding rendered without it.

10.2 Phase 2 Gate (Phase 2 -> Phase 3 unlock)

AC-D6   FR-D8 to FR-D18 all implemented and verified.
AC-D7   Executive view: NPE and CAG dry-run; stakeholder comprehension confirmed within 5 minutes.
AC-D8   Cross-site comparison sorted correctly by P1 count (primary), P2 (secondary) on test dataset.
AC-D9   Alert Center: closure audit trail end-to-end verified (open -> in_progress -> resolved).
AC-D10  Intervention Tracker: confounder note edit locked after reviewer sign-off; edit history preserved.
AC-D11  Source currency advisory label displayed correctly for Partial Extract and Version Unverified sources.
AC-D12  Insufficient Evidence state displayed when no valid rule set applies (test case verified).
AC-D13  uHoo API feasibility sprint completed and result documented.

10.3 Phase 3 Gate (Customer Portal Go-Live)

AC-D14  FR-D19 to FR-D23 all implemented and verified.
AC-D15  Security and auth design approved; tenant isolation penetration test passed.
AC-D16  Legal/medical disclaimer wording approved by designated authority (Jay Choy sign-off).
AC-D17  Customer portal certification outcome matches reviewer-approved outcome on 100% of test dataset.
AC-D18  Renewal notification (in-app + email) triggered correctly at 30-day window.
AC-D19  Customer role cannot view, edit, or access another tenant's data (verified via test).


11. Test Plan

Case                                 Test Description
Happy-path Phase 1                   All three role views load with valid rule-linked data; per-metric citation badges correct.
Missing citation block               Findings panel shows citation error; QA checklist gate prevents approval.
P1 alert creation and closure        Alert created, owner assigned, closure note added; audit trail records all events.
P1 alert overdue notification        System triggers daily in-app + email reminder when action_due_date is past.
Intervention before/after            Confounder note editable by analyst pre-sign-off; read-only after reviewer approval; edit history logged.
Source currency advisory             Partial Extract finding shows amber advisory label; certification outcome blocked.
Insufficient Evidence                No applicable rule set -> Insufficient Evidence displayed; no Pass/Conditional/Fail outcome rendered.
Cross-site ranking                   Sites sorted by P1 count desc, P2 count desc; no composite score column.
Phase 3 tenant isolation             Customer A cannot retrieve or view Customer B's data; 403 returned on cross-tenant request.
QA gate enforcement                  Report with missing action_owner (P1 item) fails release gate QA-G1.
Reviewer identity check              Non-Jay-Choy reviewer cannot move report to approved for certification outcome; gate QA-G8 blocks.
Renewal prompt                       In-app + email notification dispatched at 30-day renewal window.
Data quality statement absent        Report release blocked by gate QA-G4.


12. Risks + Mitigations

R1  Rulebook API not ready when dashboard build starts
    Mitigation: use mock Rulebook API with sample dataset for Phase 1/2 development; contract-first approach.

R2  Intervention tracking data sparsity (no before/after reading pairs logged)
    Mitigation: empty state spec with analyst prompt to log baseline before initiating intervention; Tracker card shows "No baseline recorded" guidance.

R3  Executive comprehension test failure (>5 minutes)
    Mitigation: usability testing with NPE and CAG stakeholders during Phase 2; iterate on information hierarchy before Phase 3 gate.

R4  Phase 3 tenant isolation breach
    Mitigation: security design review mandatory at Gate 2->3; penetration test required before Phase 3 go-live (AC-D15).

R5  Source currency drift (standards become outdated between reviews)
    Mitigation: quarterly OfficialStack refresh cycle; critical standards updated within 7 business days (from PSD-01 §23).

R6  Alert volume overwhelming ops team without triage strategy
    Mitigation: default sort (P1 first, Days Open descending) and filter controls designed for triage efficiency; ops review in Phase 2 dry-run.


13. Next Actions

1) Approve this PSD (Jeff + Lyra review; Jay Choy approval gate for certification-related sections).
2) Define mock Rulebook API contract for development (owner: backend lead).
3) Identify sample dataset for Phase 1 and Phase 2 dry-runs (NPE and CAG sites).
4) Schedule Phase 2 executive comprehension usability test.
5) Initiate legal/medical disclaimer wording review (required before Phase 3 go-live).
6) Plan uHoo API feasibility sprint (required before Phase 3 gate AC-D13).


Appendix A — Intervention Tracking Schema

Purpose: Define the data structure for before/after intervention records.
These fields are new and not defined in PSD-01.

Intervention Record Schema

intervention_id             UUID            System-generated. Unique per intervention.
site_name                   string          Inherited from site reading.
zone_name                   string          Inherited from site reading.
metric_name                 enum            From PSD-01 normalised metric enum.
baseline_window_start       ISO8601         Analyst-defined start of pre-intervention window.
baseline_window_end         ISO8601         Analyst-defined end of pre-intervention window.
baseline_avg_value          float           Computed mean of metric_value in baseline window.
baseline_reading_count      integer         Number of readings in baseline window.
post_window_start           ISO8601         Analyst-defined start of post-intervention window.
post_window_end             ISO8601         Analyst-defined end of post-intervention window.
post_avg_value              float           Computed mean of metric_value in post window.
post_reading_count          integer         Number of readings in post window.
delta                       float           post_avg_value - baseline_avg_value.
delta_pct                   float           (delta / baseline_avg_value) * 100.
causality_confidence        enum            high | medium | low. Analyst-assigned.
confounder_notes            text            Analyst-editable pre-sign-off; read-only post-approval.
confounder_edit_history     JSON array      [{editor_id, timestamp, previous_value, new_value}]. Immutable.
rule_citation               string          rule_id + rule_version used for threshold comparison.
confidence_label            string          Derived display label from causality_confidence enum.
intervention_status         enum            draft | analyst_submitted | reviewer_approved | archived.
reviewer_id                 string          Populated on reviewer approval.
reviewer_approved_at        ISO8601         Populated on reviewer approval.
created_by                  string          Analyst user ID.
created_at                  ISO8601         System timestamp.

Validation Rules:
- baseline_window_end must be before post_window_start (no overlap allowed).
- baseline_reading_count and post_reading_count must each be >= 1; if either is 0, card renders as "Insufficient data for comparison."
- causality_confidence must be set before intervention record can be submitted for review.
- confounder_edit_history entries are append-only; no deletion or modification of existing entries.

Confidence Label Display:
high    -> "High Confidence — strong evidence of causal link"
medium  -> "Medium Confidence — likely associated; confounders possible"
low     -> "Low Confidence — directional only; significant confounders may apply"


References

[1] FJDashboard PRD v1.1 — FJDashboard_PRD.md (2026-04-11)
[2] PSD-01 v0.3 — PSD.md (2026-03-31, updated 2026-04-11)
    §4 Upload Data Contract
    §6 Parse Outcome States
    §7 Rules Engine Contract
    §11 Reviewer Workflow
    §21 Dual Workflow System Specification
    §22 Operational Constraints Addendum
    §23 OfficialStack Reference Handling Addendum
    Appendix A — Rule Dictionary
    Appendix B — Research Mapping Annex
[3] FJ SafeSpace PRD v0.4 — PRD.md (2026-03-30, updated 2026-04-11)

---

## 14. Phase 1 Pipeline Specification (Upload + Findings + Report)

This section consolidates the Phase 1 build spec from PSD-01 v0.3. It is authoritative for the upload, parse, rules evaluation, findings composition, and report generation pipeline.

### 14.1 Supported Upload File Types

- CSV (required)
- XLSX (optional, if parser profile is enabled)
- PDF export (manual mapping only unless parser profile is approved)

### 14.2 Required Upload Columns

| Field | Type | Notes |
|---|---|---|
| site_name | string | |
| zone_name | string | |
| device_id | string | |
| reading_timestamp | ISO8601 | parseable datetime |
| metric_name | enum | normalised — see §14.4 |
| metric_value | number | |
| metric_unit | string | |

### 14.3 Optional Upload Columns

| Field | Type |
|---|---|
| floor_level | string |
| occupancy_context | string |
| sampling_duration_min | number |
| note | string |

### 14.4 Normalised Metric Enum (v1)

- co2_ppm
- pm25_ugm3
- tvoc_ppb
- temperature_c
- humidity_rh

### 14.5 Validation and Normalisation Rules

- Reject rows with missing required fields.
- Reject rows with non-numeric metric_value.
- Reject timestamps beyond +5 minutes of server time.
- Warn (do not fail) on physically implausible outliers.
- Convert mixed units into canonical units before rule evaluation.

### 14.6 Parse Outcome States

| State | Meaning |
|---|---|
| PASS | All required checks succeed |
| PASS_WITH_WARNINGS | Upload accepted with non-blocking anomalies |
| FAIL | Structural or required-field issues exceed policy threshold |

### 14.7 Rules Engine Contract

Each rule record includes:

| Field | Description |
|---|---|
| rule_id | Unique rule identifier |
| metric_name | Target metric |
| band | good / watch / critical |
| min_value, max_value | Threshold bounds |
| interpretation_template | Plain-language finding text |
| workforce_impact_template | Indicator-based impact phrasing |
| recommended_action_template | Corrective action guidance |
| source_ref_ids[] | Supporting source references |
| confidence_level | high / medium / low |
| rule_version | Semver version string |

Determinism requirement: given identical input + identical rule_version, outputs must be identical.

### 14.8 Findings Composition Logic

Output levels:
- Metric-level finding
- Zone-level summary
- Site-level executive summary

Priority labels:
- P1: Critical risks or sustained adverse patterns
- P2: Moderate concern requiring planned intervention
- P3: Optimisation opportunities

Language policy:
- Use indicator phrasing: "may indicate", "is associated with"
- Avoid deterministic medical causality claims

### 14.9 Citation and Evidence Policy

- Any non-obvious claim must include at least one approved source reference.
- Missing citation blocks report approval.
- All source entries must be versioned and reviewable.

### 14.10 Report Specification (v1)

Required sections:
1. Cover (site, date, assessment ID, version)
2. Executive Summary (layman-friendly)
3. IAQ Findings by zone
4. Occupant/workforce implication (indicator-based)
5. Recommended actions (P1/P2/P3)
6. Standards and research references
7. Limitations + disclaimer
8. Next verification recommendation

Report metadata: report_id, generated_at, rules_version, reviewer_name, reviewer_status

Export: PDF (required); JSON archive (optional internal)

### 14.11 Reviewer Workflow States

| State | Meaning |
|---|---|
| draft_generated | Report auto-generated, not yet reviewed |
| in_review | Assigned to reviewer |
| revision_required | Reviewer requested changes |
| approved | Final approver signed off |
| exported | Delivered to customer |

Reviewer controls:
- Edit narrative blocks
- Accept/reject flagged findings
- Resolve citation exceptions
- Approve with name + timestamp

### 14.12 Phase 1 Acceptance Criteria

| ID | Criterion |
|---|---|
| AC1 | 10 sample uploads processed end-to-end |
| AC2 | Parse success >=95% |
| AC3 | Citation completeness >=95% where required |
| AC4 | Reviewer approval flow functional end-to-end |
| AC5 | Stable export for all defined test cases |

### 14.13 Phase 1 Test Plan

- Happy-path upload
- Missing-column failure
- Invalid-unit normalisation
- Outlier warning handling
- Multi-zone summary generation
- Citation-missing approval block
- Revision and re-approval cycle

---

## 15. Standards Integration Constraints (Locked 2026-04-08)

- Report generator must persist rule_version and citation_unit_ids for each finding block.
- SLA timestamp anchor = analyst_upload_time (not last sensor reading time).
- Missing citation data must block reviewer approval state transition to approved.
- Phase 1 implementation should prepare schema hooks for future ingestion services without requiring redesign.

---

## 16. Dual Workflow Service Specification (Locked 2026-04-08)

### 16.1 Workflow A Service Boundary (Reference → Rulebook)

Services:
- Source Intake Service
- Citation Extraction Service
- Review and Approval Console
- Rulebook Publish Service

Data contracts: source_id, source_version, citation_unit_id, rule_version, approval_status

Gates:
- No rule publish without reviewer and approver sign-off.
- Superseded rules remain queryable but non-default.

### 16.2 Workflow B Service Boundary (Scan → Report)

Services:
- Upload and Validation Service
- Readings Normalisation Service
- Rule Evaluation Service (read-only rulebook)
- Report Generation Service
- Reviewer QA and Release Service

Data contracts: assessment_id, input_file_id, rule_version_used, citation_unit_ids, reviewer_status

Gates:
- Report approval blocked if required citations are missing.
- Report approval blocked if rule_version is undefined, disclaimer not approved, or approver is not Jay Choy.

### 16.3 Runtime Integrity Constraints

- Rule Evaluation Service must be read-only against Rulebook runtime store.
- Any threshold mutation request in Workflow B must be rejected.
- Every report output must include rule_version_used and citation trace.

---

## 17. Operational Constraints (Locked 2026-04-08)

- Workflow B report SLA timer starts at analyst upload timestamp.
- Approval role check is mandatory: only Jay Choy can move report state from in_review to approved.
- Certification outcome service is strictly rule-based; override endpoint is disabled.
- Context applicability check is mandatory for mixed premises (industrial, office, residential).
- If no valid applicable rule set exists for a context/metric, system must return "Insufficient Evidence" state and block certification decision.

---

## 18. OfficialStack Reference Handling (2026-04-11)

Source metadata fields required in standards registry and runtime payload:
- source_version_label
- source_effective_date
- source_currency_status
- source_completeness_status
- source_last_verified_at

Allowed source_currency_status values: Current Verified / Partial Extract / Version Unverified / Superseded

Evaluation engine constraints:
1. Rules from Current Verified sources → eligible for certification path.
2. Rules from Partial Extract or Version Unverified → advisory only with explicit warning labels; block certification decision.
3. Rules from Superseded sources → blocked unless explicitly retained by governance exception.

QA gate: report approval must fail if any certification-impact finding cites a non-Current-Verified source.

Sync requirement: OfficialStack source registry reviewed quarterly; critical standards updated within 7 business days after detected revision.

No manual threshold override path shall exist in Workflow B. Any threshold change must go through Workflow A governance and approval before runtime use.

---

## Appendix B — Rule Dictionary

Source: PSD-01 Appendix A, Rule Dictionary v0.2

### Important Notes
- Thresholds below are draft working values for implementation scaffolding.
- Final production values must be approved before customer-facing release.
- Wording remains indicator-based to avoid over-claiming medical certainty.

### CO2 (co2_ppm)

| Band | Range | Interpretation | Workforce Impact | Action | Confidence |
|---|---|---|---|---|---|
| Good | 0–800 ppm | Ventilation appears adequate for current occupancy | Conditions generally support comfort and concentration | Maintain current ventilation and monitoring routine | High |
| Watch | >800–1200 ppm | Ventilation may be suboptimal during parts of occupancy | May be associated with lower perceived freshness and focus | Increase fresh air exchange; review occupancy density and HVAC scheduling | Medium |
| Critical | >1200 ppm | Ventilation is likely inadequate for current operating conditions | May indicate elevated risk of discomfort and reduced cognitive effectiveness | Trigger immediate ventilation correction and reassessment | High |

### PM2.5 (pm25_ugm3)

| Band | Range | Interpretation | Workforce Impact | Action | Confidence |
|---|---|---|---|---|---|
| Good | 0–12 ug/m3 | Fine particulate levels are in a lower-risk operating range | Supports healthier breathing conditions indoors | Maintain filtration and source-control practices | Medium |
| Watch | >12–35 ug/m3 | Particulate concentration is elevated and should be managed | May be associated with irritation in sensitive occupants | Inspect filters, airflow, and pollutant sources; apply mitigation | Medium |
| Critical | >35 ug/m3 | Particulate burden is high and needs prompt intervention | May indicate increased respiratory stress risk | Start urgent remediation and schedule post-fix verification | Medium |

### TVOC (tvoc_ppb)

| Band | Range | Interpretation | Workforce Impact | Action | Confidence |
|---|---|---|---|---|---|
| Good | 0–500 ppb | VOC levels are within acceptable operating range | Lower likelihood of odour-related discomfort | Maintain source-control discipline | Medium |
| Watch | >500–1000 ppb | VOC concentration is elevated and may indicate source build-up | May be associated with headache/discomfort in susceptible groups | Identify likely sources, improve ventilation, and recheck | Low |
| Critical | >1000 ppb | VOC concentration is materially high and requires immediate investigation | May indicate elevated IAQ risk | Trigger immediate source mitigation and follow-up verification | Low |

### Temperature (temperature_c)

| Band | Range | Interpretation | Workforce Impact | Action | Confidence |
|---|---|---|---|---|---|
| Good | 21.0–26.0 °C | Thermal conditions align with common workplace comfort range | Supports comfort and stable performance for most occupants | Maintain setpoint and monitor drift | Medium |
| Watch | 18.0–<21.0 °C or >26.0–28.0 °C | Temperature is outside preferred range for part of occupancy | May be associated with reduced comfort and concentration | Tune HVAC setpoints and inspect zone imbalance | Medium |
| Critical | <18.0 °C or >28.0 °C | Temperature is in high-discomfort territory | May indicate elevated comfort/performance risk | Apply immediate thermal correction and re-test | Medium |

### Relative Humidity (humidity_rh)

| Band | Range | Interpretation | Workforce Impact | Action | Confidence |
|---|---|---|---|---|---|
| Good | 40–60 %RH | Humidity is in a generally favourable indoor range | Supports comfort and moisture balance | Maintain humidity controls | Medium |
| Watch | >30–<40 %RH or >60–70 %RH | Humidity is drifting from preferred operating range | May be associated with dryness/discomfort or dampness concerns | Adjust humidity control strategy and ventilation balance | Medium |
| Critical | <=30 %RH or >70 %RH | Humidity is outside safe comfort-management range | May indicate higher risk of IAQ-related discomfort | Trigger immediate moisture-control intervention and follow-up scan | Medium |

### Source Reference Catalog

| ID | Source |
|---|---|
| SRC-SS554 | SS 554:2016 Indoor Air Quality for Air-Conditioned Buildings (Singapore) |
| SRC-WELL-AIR | WELL Performance Verification Guidebook (Q4 2022) |
| SRC-WELL-THERMAL | WELL thermal comfort guidance within WELL PV framework |
| SRC-RESET-VIRAL | RESET Viral Index Whitepaper v1.1 |
| SRC-UHOO-GUIDE | uHoo Business Essentials and related technical collateral |
| SRC-UHOO-VIRALINDEX | uHoo Virus Index document |

### Open Validation Items
- Confirm final CO2/TVOC policy thresholds with governance owner.
- Confirm PM2.5 thresholds against selected certification pathway.
- Finalise legal disclaimer language for workforce-impact section.

---

## Appendix C — Research Mapping Annex

Source: PSD-01 Appendix B, Research Mapping Annex v0.2

### Mapping Record Structure (Required Fields)

- Metric
- Reading value + unit
- Threshold band
- Layman interpretation
- Workforce impact (indicator-based)
- Recommended action
- Source reference(s)
- Confidence level
- Rule version

### Language Guardrails

Use:
- "is associated with"
- "may indicate"
- "suggests elevated risk"

Avoid:
- Deterministic medical causality claims
- Certainty wording without supporting evidence

### Citation Policy

- Every non-obvious finding must include at least one approved reference.
- Missing citation blocks final report approval.
- Citations must reference source ID and version/date where available.

### Confidence Policy

| Level | Meaning |
|---|---|
| High | Strong standard alignment and stable evidence support |
| Medium | Reasonable support with bounded assumptions |
| Low | Directional guidance only; requires explicit caveat |

### Reviewer QA Checks

Before approval, reviewer confirms:
- Correct metric-unit mapping
- Correct threshold-band assignment
- Claim language matches confidence level
- Citation completeness for all non-obvious findings
- Disclaimer included where required

### Output Quality Standard

A mapping output is acceptable only when:
- Reasoning is reproducible
- Interpretation is understandable by a layperson
- Recommendations are actionable
- Evidence links are traceable

### Open Items
- Confirm final source hierarchy for conflict resolution.
- Define fallback language when evidence confidence is low.
- Confirm mandatory disclaimer block for customer reports.

---

*This document (FJDashboard_PSD.md) supersedes PSD-01 v0.3 (PSD.md, 2026-03-31) and serves as the consolidated Phase 1 pipeline + dashboard specification from 2026-04-11.*
