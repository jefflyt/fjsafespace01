# FJDashboard — Product Specification Document (PSD-02)

| Field | Value |
|---|---|
| **Document** | FJDashboard PSD-02 v0.2 |
| **Scope** | Dashboard Layer — Phase 1 (Analyst View) + Phase 2 (Internal Dashboard) + Phase 3 (Customer Portal) |
| **Date** | 2026-04-11 (Updated: 2026-04-12) |
| **Owner** | Jeff |
| **PM** | Lyra |
| **Status** | Draft for Review |
| **Parent PRD** | FJDashboard PRD v1.1 (`FJDashboard_PRD.md`) |
| **Parent PSD** | PSD-01 v0.3 (`PSD.md` — superseded) |

### Locked Tech Stack Decisions (2026-04-12)

| Decision | Value |
|---|---|
| Architecture | Full-stack Next.js (no separate backend) with Prisma ORM |
| Database | PostgreSQL on Render |
| File storage | Cloudflare R2 |
| Auth | No auth for Phase 1/2 (internal laptop only). Clerk for Phase 3. |
| Background jobs | None — synchronous processing throughout |
| PDF generation | Gotenberg (open-source Docker microservice) |
| Hosting | Vercel (frontend) + Render (PostgreSQL) + Cloudflare R2 (files) |

---

## 0. Document Control

| Field | Detail |
|---|---|
| **Purpose** | Provide build-ready implementation detail for the FJDashboard product layer across all three phases |
| **Source of truth** | This document governs dashboard scope, data contracts, service boundaries, view specifications, and acceptance criteria |
| **Parent documents** | FJDashboard PRD v1.1 (product requirements) and PSD-01 v0.3 (Phase 1 pipeline specification) |
| **Change control** | Any change to dashboard schema, service boundaries, view layout rules, or QA gates requires a version bump and decision-log entry in FJDashboard PRD |
| **Approval authority** | Jay Choy — final approver for rule changes, report release, and certification outcomes |
| **Legal gate** | Phase 3 customer portal go-live is blocked until legal/medical disclaimer wording is approved |


## 1. Objective

Deliver the dashboard layer of FJ SafeSpace that converts approved, rule-based findings into role-appropriate, traceable, and actionable views for internal operators, executives, and (in Phase 3) customers.

> The dashboard does **not** generate findings or set thresholds. It reads from the Rulebook runtime API (approved outputs only) and presents data through role-gated views.

| Phase | Scope |
|---|---|
| **Phase 1** | Analyst / Operations view — upload queue visibility, findings panel, report status tracking |
| **Phase 2** | Internal dashboard — Global Portfolio (FJ Executive), Leaderboard, Cross-Site Comparison, Zone/Floor Drilldown |
| **Phase 3** | Customer portal — scoped building view, certification status, renewal workflow |

---

## 2. Scope Boundaries

### In Scope

- Role-based dashboard views: FJ Executive, Analyst / Operations, Customer (Phase 3)
- Dashboard read layer consuming Rulebook runtime API
- Cross-site Leaderboard ranked by FJ SafeSpace Wellness Index
- Daily summary card (top 3 risks, top 3 actions, next verification date)
- Report version history and status tracking
- Trend visualisation per parameter
- Source currency status badges on all certification-related views
- Customer portal: certification status summary, Verification Summary, Certificate, Entrance Decal, renewal prompt (Phase 3)

### Out of Scope

- Findings generation or threshold setting (governed by Rulebook governance workflow)
- Any path for manual threshold override — permanently disabled at service level
- Customer self-service report editing
- BMS/IoT control automation
- Alert queue management, ticket assignment, and action due dates
- Intervention tracking module (before/after snapshots)
- Live uHoo API ingestion before Phase 3 API feasibility sprint is complete

---

## 3. End-to-End Workflow

### Phase 1 Workflow (Analyst View)

```
Upload → Parse + Validate → Rule Evaluation → Findings Stored
  → Dashboard Analyst View
      ├── Upload queue status
      ├── Findings panel with citation badges
      ├── Report status
      └── QA checklist gate
```

### Phase 2 Workflow (Internal Dashboard)

```
Approved Findings
  → Dashboard Aggregation Service
      ├── FJ Executive View (Portfolio): Leaderboard | Space Health Rating | top risks | top actions
      └── Analyst / Operations View: upload queue | findings panel | report draft builder
```

### Phase 3 Workflow (Customer Portal)

```
Approved Report + Certification Outcome
  → Tenant-Isolated Customer View
      ├── FJ SafeSpace Wellness Index status
      ├── Verification Deliverables (Summary, Certificate, Decal)
      ├── Renewal date
      └── Disclaimer (always visible)
  → Renewal Trigger → in-app + email → recertification workflow prompt
```


---

## 4. Dashboard Data Contract (Schema v1)

### 4.1 New Fields (extending PSD-01 data model)

| Field | Type | Required | Values / Constraints |
|---|---|---|---|
| `dashboard_role_view` | enum | Yes | `executive` \| `operations` \| `customer` |
| `data_quality_score` | float 0.0–1.0 | Yes | Composite of `uptime_ratio` and `outlier_rate` |
| `uptime_ratio` | float 0.0–1.0 | Yes | Proportion of expected readings received in window |
| `outlier_rate` | float 0.0–1.0 | Yes | Proportion of readings flagged as implausible outliers |
| `source_currency_status` | enum | Yes | `Current Verified` \| `Partial Extract` \| `Version Unverified` \| `Superseded` |
| `wellness_index_score` | float | Yes | `0.0–100.0` (Weighted index model, dynamically using weights provided by the Rulebook) |
| `certification_outcome` | enum | Yes | `Healthy Workplace Certified` \| `Healthy Space Verified` \| `Improvement Recommended` \| `Insufficient Evidence` |
| `benchmark_lane` | enum | Yes | `FJ SafeSpace Benchmark` (SS554 + WELL composite) |
| `days_open` | integer | Derived | Calculated from alert creation timestamp to current date |
| `tenant_id` | UUID | Yes (Ph3) | Required for Phase 3 customer portal; null for Phase 1/2 |

### 4.2 Inherited Fields (from PSD-01)

All fields from PSD-01 §4 — `site_name`, `zone_name`, `device_id`, `reading_timestamp`, `metric_name`, `metric_value`, `metric_unit` — and report metadata fields (`report_id`, `generated_at`, `rules_version`, `reviewer_name`, `reviewer_status`) remain unchanged.

### 4.3 Validation Rules

- `data_quality_score` must be computable before dashboard card renders; if not computable, card shows **"Data Quality: Unavailable"** with reason.
- `source_currency_status` must be present on every certification-impact finding; absence blocks dashboard render for that finding.
- `tenant_id` is mandatory in Phase 3; any customer-role request without a valid `tenant_id` returns `403`.

---

## 5. Service Architecture

> All three services consume the Rulebook runtime API in **read-only** mode. No service in the dashboard layer may write to or mutate the Rulebook.

### 5.1 Dashboard Aggregation Service

**Purpose:** Compute and serve site/zone summary cards for all role views.

**Inputs:**
- Approved findings (from Rule Evaluation Service)
- Rulebook runtime API (`rule_version`, `citation_unit_ids`, `benchmark_lane`)
- Site metadata (`site_name`, `zone_name`, `device_id`)

**Outputs:**

| Output | Fields |
|---|---|
| Site summary card | `site_name`, `certification_outcome`, `wellness_index_score`, `top_3_risks[]`, `top_3_actions[]`, `next_verification_date`, `last_scan_date` |
| Zone drilldown card | `zone_name`, `metric_readings[]`, `threshold_band[]`, `source_currency_status[]`, `trend_sparkline_data[]` |
| Cross-site comparison row | `site_name`, `wellness_index_score`, `certification_outcome` — sorted by wellness index descending |

**Runtime integrity constraints:**
- Every finding served must include `rule_version` + `citation_id`; any finding missing these is rejected from dashboard output.
- If `certification_outcome` cannot be determined due to missing applicable rules, service must return `Insufficient Evidence` — never `null` or a default pass value.
- Threshold mutation requests rejected at service boundary (`403`).

---

## 6. View Specifications

### 6.1 Executive View

> **Available from:** Phase 2

**Layout (top to bottom):**
1. Page header: site selector (multi-select) + date range picker
2. FJ SafeSpace Wellness Index card per site: certification outcome chip (colour-coded) + `last_scan_date`
3. Top 3 Risks panel: P1 findings, metric name, zone, benchmark limit exceeded
4. Top 3 Actions panel: action text, owner, due date, priority chip
5. Next Verification Date badge

**Colour coding:**

| Outcome | Colour | Notes |
|---|---|---|
| Healthy Workplace Certified | Green | ≥ 90% |
| Healthy Space Verified | Amber | 75% – 89% |
| Improvement Recommended | Red | < 75% |
| Insufficient Evidence | Grey | Tooltip: *"Insufficient rule coverage for this context"* |

- **Load priority:** Risks and actions must render before charts or secondary data.
- **Comprehension target:** ≤5 minutes for executive stakeholder.
- **Empty state:** "No findings available — upload required" with link to upload page.

### 6.2 Analyst / Operations View

> **Available from:** Phase 1

**A) Upload Queue Table**

| Column | Notes |
|---|---|
| File | File name |
| Site | Site name |
| Upload Timestamp | |
| Status | `pending \| processing \| complete \| failed` |
| Parse Outcome | `PASS \| PASS_WITH_WARNINGS \| FAIL` |
| Actions | View parse log / Retry (if failed) / Proceed to findings |

**B) Findings Panel**

Per-metric row: `Metric Name | Current Value | Unit | Threshold Band | Rule Interpretation | Citation Badge | Confidence | Action Priority`

- **Citation Badge:** clickable → shows `citation_unit_id`, source title, `source_currency_status`, `rule_version`
- Source currency badge follows same colour coding as Operations View

**C) Report Draft Builder**

- Report status chip: `draft_generated | in_review | revision_required | approved | exported`
- Approval button **disabled** until all QA checklist items are confirmed:

| # | QA Checklist Item |
|---|---|
| 1 | All non-obvious findings have `citation_id` |
| 2 | All citation sources are `Current Verified` (or advisory label confirmed) |
| 3 | Data quality statement present |
| 4 | Disclaimer block confirmed |
| 5 | Reviewer identity confirmed (Jay Choy only for certification outcomes) |

### 6.3 Customer Portal View

> **Available from:** Phase 3

**Layout:**
1. Legal/medical disclaimer banner (always visible, top of page — approved wording required)
2. FJ SafeSpace Wellness Index card: `certification_outcome | wellness_index_score | site_name | assessment_date | next_renewal_date`
3. Verification Deliverables: Download links for Verification Summary (PDF), Certificate (PDF), and Entrance Decal (Image with QR).
4. Renewal prompt: *"Your certification is due for renewal on [date]. Contact FJ SafeSpace to schedule."*
5. Tenant scoping: customer sees only their own `tenant_id`-scoped sites — no cross-tenant data exposure

> **Customer cannot:** edit findings, modify thresholds, change certification outcome, or access raw readings.
> **Insufficient Evidence display:** *"Wellness Index: Insufficient Data — additional assessment required."*

---

## 7. Rule-Evaluation Integration Constraints

> These constraints mirror PSD-01 §21.3 and §23 and **must not be weakened**.

- All dashboard modules consume approved Rulebook runtime API only — no direct DB reads bypassing the API.
- Any module request that produces a finding without `rule_version` + `citation_id` fails validation and is rejected from dashboard output.
- The Wellness Index calculation **must** derive its weights and multiplier logic directly from the queried `RulebookEntry` to ensure the documentation remains the strictly version-controlled anchor base.
- Benchmark lane must be explicit per metric, tracking strictly against the **FJ SafeSpace Benchmark** limits.
- `Insufficient Evidence` must be returned and displayed when no valid applicable rule set exists — never silently dropped, defaulted to Pass, or hidden.
- Rules from `Partial Extract` or `Version Unverified` sources are advisory only — dashboard must display an explicit advisory warning label; these rules **cannot** produce a certification outcome.
- No manual threshold override path exists — any such request returns `403`.
- `source_currency_status` must be populated on every certification-impact finding; absence blocks render for that finding.

---

## 8. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-D1 | Reproducibility | Same input + same `rule_version` always produces identical dashboard output |
| NFR-D2 | Traceability | Every metric card, finding, and alert includes `rule_version` and `citation_id` |
| NFR-D3 | Performance | Dashboard page load < 3 seconds (all views, standard network) |
| NFR-D4 | Performance | Report draft generation < 2 minutes |
| NFR-D5 | Performance | Findings available in dashboard within < 2 hours of analyst upload (Phase 2 target) |
| NFR-D6 | Security (Ph1/2) | No authentication required. Internal laptop only — not network-accessible to customers. No login, sessions, or tokens. |
| NFR-D7 | Security (Ph3) | Clerk auth; JWT with `tenant_id` claim; tenant data strictly isolated. Phase 3 only. |
| NFR-D8 | Availability (Ph3) | 99.5% uptime at Phase 3 launch (planned maintenance excluded); roadmap to 99.9% at 12-month review |
| NFR-D9 | Audit logging | `confounder_edit_history` immutable; alert closure audit trail immutable |
| NFR-D10 | Accessibility | Executive view comprehensible by non-technical stakeholder within 5 minutes |

---

## 9. QA Gate Enhancements

> A dashboard view render or report release **fails** if any of the following is true:

| Gate | Fail Condition |
|---|---|
| **QA-G4** | `data_quality_score` or data quality statement is absent from report |
| **QA-G5** | `rule_version` or `citation_id` is absent from any certification-impact finding |
| **QA-G6** | `source_currency_status` is non-`Current Verified` for a cert-path finding without advisory warning label |
| **QA-G7** | `Insufficient Evidence` state is absent from UI when no valid rule set applies |
| **QA-G8** | Reviewer is not Jay Choy for report state transition to `approved` (certification outcomes) |
| **QA-G9** | *(Phase 3)* `tenant_id` is absent or mismatched for any customer-role data request |

---

## 10. Acceptance Criteria

### Phase 1 Gate (Phase 1 → Phase 2 unlock)

| ID | Criterion |
|---|---|
| AC-D1 | FR-D1 to FR-D7 all implemented and verified on test dataset |
| AC-D2 | Analyst view page load < 3 seconds on standard network |
| AC-D3 | Citation badge visible and correct on all findings in test dataset |
| AC-D4 | QA checklist gate blocks report approval when any citation is missing (test case verified) |
| AC-D5 | Findings panel shows `rule_version` on every row; no finding rendered without it |

### Phase 2 Gate (Phase 2 → Phase 3 unlock)

| ID | Criterion |
|---|---|
| AC-D6 | FR-D8 to FR-D18 all implemented and verified |
| AC-D7 | Executive view: NPE and CAG dry-run; stakeholder comprehension confirmed within 5 minutes |
| AC-D8 | Cross-site comparison sorted correctly by wellness index on test dataset |
| AC-D11 | Source currency advisory label displayed correctly for Partial Extract and Version Unverified sources |
| AC-D12 | Insufficient Evidence state displayed when no valid rule set applies (test case verified) |
| AC-D13 | uHoo API feasibility sprint completed and result documented |

### Phase 3 Gate (Customer Portal Go-Live)

| ID | Criterion |
|---|---|
| AC-D14 | FR-D19 to FR-D23 all implemented and verified |
| AC-D15 | Clerk auth and tenant isolation tested; penetration test passed |
| AC-D16 | Legal/medical disclaimer wording approved (Jay Choy sign-off) |
| AC-D17 | Customer portal certification outcome matches reviewer-approved outcome on 100% of test dataset |
| AC-D18 | Renewal notification triggered correctly at 30-day window |
| AC-D19 | Customer role cannot view, edit, or access another tenant's data (verified via test) |

---

## 11. Test Plan

| Test Case | Description |
|---|---|
| Happy-path Phase 1 | All role views load with valid rule-linked data; citation badges correct |
| Missing citation block | Findings panel shows citation error; QA checklist prevents approval |
| Source currency advisory | Partial Extract finding shows amber advisory label; certification outcome blocked |
| Insufficient Evidence | No applicable rule set → `Insufficient Evidence` displayed; no Pass/Fail rendered |
| Cross-site ranking | Sites sorted by Wellness Index DESC; |
| Phase 3 tenant isolation | Customer A cannot retrieve Customer B's data; `403` returned on cross-tenant request |
| Reviewer identity check | Non-Jay-Choy reviewer cannot approve certification outcome; QA-G8 blocks |
| Renewal prompt | In-app + email dispatched at 30-day renewal window |
| Data quality statement absent | Report release blocked by QA-G4 |

---

## 12. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| R1: Rulebook API not ready when dashboard build starts | Mock Rulebook API with sample dataset for Phase 1/2 development; contract-first approach |
| R3: Executive comprehension test failure (>5 minutes) | Usability testing with NPE and CAG stakeholders during Phase 2; iterate before Phase 3 gate |
| R4: Phase 3 tenant isolation breach (Clerk) | Clerk org-scoped JWT enforced at middleware; penetration test required before Phase 3 go-live |
| R5: Source currency drift | Quarterly OfficialStack refresh cycle; critical standards updated within 7 business days |

---

## 13. Next Actions

1. Approve this PSD (Jeff + Lyra review; Jay Choy approval gate for certification-related sections).
2. Define mock Rulebook API contract for development (owner: backend lead).
3. Identify sample datasets for Phase 1 and Phase 2 dry-runs (NPE and CAG sites).
4. Schedule Phase 2 executive comprehension usability test.
5. Initiate legal/medical disclaimer wording review (required before Phase 3 go-live).
6. Plan uHoo API feasibility sprint (required before Phase 3 gate AC-D13).

---

## References

| # | Document | Notes |
|---|---|---|
| 1 | FJDashboard PRD v1.1 (`FJDashboard_PRD.md`) | 2026-04-11 |
| 2 | PSD-01 v0.3 (consolidated into this document 2026-04-11) | §4 Upload contract; §6 Parse states; §7 Rules engine; §11 Reviewer workflow; §21–23 Workflow spec; Appendix A Rule Dictionary; Appendix B Research Mapping |
| 3 | FJ SafeSpace PRD v0.4 (consolidated into FJDashboard_PRD.md 2026-04-11) | |

