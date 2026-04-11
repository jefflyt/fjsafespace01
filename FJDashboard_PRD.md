# FJDashboard — Product Requirements Document
**Version:** 1.1
**Date:** 2026-04-11
**Owner:** Jeff
**PM:** Lyra
**Parent PRD:** FJ SafeSpace PRD v0.4
**Status:** Open Questions Locked — Pending Jay Choy Approval Gate

---

## 0. Document Control

| Field | Value |
|---|---|
| Purpose | Define the FJDashboard product layer as a standalone reviewable specification, derived from the FJ SafeSpace PRD v0.4. |
| Review cadence | Weekly (every Monday) |
| Change control | Any change to dashboard scope, KPI definitions, or role-access rules requires a Decision Log entry. |
| Approval authority | Jay Choy — final approver for threshold rule changes, report release, and certification outcomes. |
| Legal gate | Production customer dashboard release is blocked until legal/medical disclaimer wording is approved. |

---

## 1. Product Objective

Build the **dashboard layer** of the FJ SafeSpace platform that gives internal and customer-facing stakeholders a clear, actionable, and fully traceable view of Indoor Air Quality (IAQ) status across sites and zones.

The FJDashboard converts rule-based findings into:
- **Operational visibility** for analysts managing scan-to-report workflows.
- **Executive summaries** for decision-makers needing fast risk identification.
- **Customer-facing certification status** (Phase 3, post-gate).

---

## 2. Problem Statement

FJ SafeSpace can generate findings and reports from uHoo IAQ data, but stakeholders currently lack a real-time or near-real-time interface to:
- Monitor site/zone status across the portfolio.
- Track alert resolution progress.
- Compare multi-site performance.
- Observe intervention impact over time.

Without this layer, operational efficiency and executive confidence are limited, and the product cannot scale to customer self-service.

---

## 3. Outcome Definition

### Business Outcomes
- Operations team can triage and close air quality issues faster.
- Executives can identify top risks and required actions in ≤5 minutes.
- Customer trust increases via transparent, traceable certification status.

### Product Outcomes
- All dashboard views are role-appropriate (Executive, Operations, Analyst).
- Every insight on the dashboard is traceable to a `rule_version` and `citation_id`.
- Alert-to-closure workflow is visible and audit-ready.
- Intervention tracker shows before/after comparison with confidence labels.

---

## 4. Personas

| Persona | Role | Key Needs | Pain Points |
|---|---|---|---|
| **Executive / Decision Maker** | Customer or internal leadership | Quick risk summary, certification status, recommended actions | Raw IAQ numbers are uninterpretable |
| **Operations Manager** | Internal FJ staff | Site/zone health at a glance, alert queue, action ownership | No centralised alert tracking today |
| **Internal Analyst** | FJ analyst | Data upload, rule-based findings, report draft generation | Manual inconsistency, slow report cycle |
| **Internal Reviewer / Approver** | Jay Choy or designated reviewer | Audit trail, confidence labels, QA checklist, sign-off | Unclear rationale behind recommendations |

---

## 5. Scope Boundaries

### In Scope
- Role-based dashboard modes: Executive, Operations, Analyst
- Site-level and Zone/Floor-level views
- Cross-site comparison view
- Critical parameter alert queue with owner, due date, and closure status
- Intervention Tracker: before/after snapshots with confidence labels and confounder notes
- Daily summary card: top 3 risks, top 3 actions, verification due date
- Report version history and comparison view (Phase 2)
- Customer portal certification status view (Phase 3, post-gate)

### Out of Scope (current cycle)
- Non-IAQ parameters outside current certification scope
- Any feature that removes or weakens rule/citation governance controls
- Customer self-service report editing
- BMS/IoT direct control automation
- Guaranteeing deterministic medical causality claims

---

## 6. Product Principles (Anti-Drift Guardrails)

| Principle | Meaning |
|---|---|
| **Evidence before aesthetics** | Every dashboard metric must be traceable to an approved rulebook entry. |
| **Explainable scoring** | No black-box scoring. All threshold bands and interpretations are rule-version-pinned. |
| **Internal reliability first** | Executive and customer views are Phase 2/3; internal operations view ships first. |
| **Versioned logic** | Reproducibility: same reading + same rule version = same dashboard output. |
| **No manual override** | No threshold override is permitted in production, on any dashboard view, under any circumstance. |
| **Insufficient Evidence is a valid and visible state** | Must be preserved and surfaced to users — never silently upgraded. |

---

## 7. Functional Requirements by Phase

### Phase 1 — Upload + Findings + Internal Analyst View

| ID | Requirement |
|---|---|
| FR-D1 | Analyst dashboard shows current upload queue status (pending, processing, complete, failed). |
| FR-D2 | Upload module accepts defined schema (CSV/PDF export from uHoo). |
| FR-D3 | Parser validation summary (fields normalised, missing fields flagged) is visible to analyst. |
| FR-D4 | Findings panel displays rule-based results per metric with: current value, threshold band, interpretation text, source citation ID, confidence level, and action priority. |
| FR-D5 | Report builder status (draft / under review / approved) is visible in analyst dashboard. |
| FR-D6 | Reviewer QA checklist is accessible and completion-gated before report approval. |
| FR-D7 | All findings displayed include `rule_version` and `citation_id` — non-negotiable. |

### Phase 2 — Internal Dashboard v2 (Operations + Executive Views)

| ID | Requirement |
|---|---|
| FR-D8 | Role-based dashboard modes: Executive, Operations, Analyst — separate view layouts. |
| FR-D9 | **Site-level summary cards**: IAQ health score by site, top risk parameter, certification status, last scan date. |
| FR-D10 | **Zone/Floor-level drill-down**: parameter readings per zone, status per metric, trend sparklines. |
| FR-D11 | **Cross-site comparison view**: rank sites by number of P1 (Critical) breach count, secondary sort by P2 count. Display as `P1: N \| P2: N \| P3: N` per site — no composite score. |
| FR-D12 | **Critical parameter queue**: filterable list of all parameters currently in breach, with owner, due date, and closure status. |
| FR-D13 | **Alert Center**: failed parameter list with owner assignment, due date, closure status, and audit trail. |
| FR-D14 | **Intervention Tracker**: before/after reading snapshots with: confidence label, confounder notes, time delta, and rule citation. |
| FR-D15 | **Daily Summary Card**: top 3 risks, top 3 recommended actions, next verification due date. |
| FR-D16 | **Report version history**: list of all reports per site with version, rule version used, reviewer, and approval date. |
| FR-D17 | **Trend visualisation**: time-series chart per parameter showing pre/post intervention comparison. |
| FR-D18 | **Source currency status** is visible on every page that references a certification finding: `{Current Verified / Partial Extract / Version Unverified / Superseded}`. |

### Phase 3 — Customer Portal + Live Dashboard

| ID | Requirement |
|---|---|
| FR-D19 | Role-based authentication with tenant data separation (customer only sees their sites). |
| FR-D20 | Customer portal view: certification status (Pass / Conditional / Fail / Insufficient Evidence), next renewal date, corrective action status. |
| FR-D21 | Live uHoo API ingestion (polling/webhook per API feasibility sprint outcome). |
| FR-D22 | Renewal reminders and recertification workflow trigger (in-app notification + email). |
| FR-D23 | Legal/medical disclaimer visible on all customer-facing pages (approved wording required before go-live). |

---

## 8. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-D1 | **Reproducibility**: identical input + identical rule version must always produce identical dashboard output. |
| NFR-D2 | **Traceability**: every metric card, finding, and alert links to its rule and citation source. |
| NFR-D3 | **Performance**: dashboard page load <3 seconds; report draft generation <2 minutes (Phase 1). |
| NFR-D4 | **Security**: Phase 1/2 internal-only. Phase 3 requires role-based auth and tenant isolation. |
| NFR-D5 | **Availability target (Phase 3)**: 99.5% uptime at Phase 3 launch (planned maintenance windows excluded). Roadmap to 99.9% post-stabilisation; 12-month review trigger. |
| NFR-D6 | **Accessibility**: Executive view must be comprehensible to a non-technical stakeholder within 5 minutes without assistance. |

---

## 9. FJ Differentiation Requirements (Must Retain)

These requirements distinguish FJDashboard from commodity IAQ dashboards and must never be removed or weakened.

| # | Requirement |
|---|---|
| D1 | Every finding is traceable to `rule_version` + `citation_id`. |
| D2 | Source currency status (`Current Verified / Partial Extract / Version Unverified / Superseded`) is visible in report metadata and on relevant dashboard cards. |
| D3 | No manual threshold override is allowed under any circumstance in production. |
| D4 | `Insufficient Evidence` state is preserved, user-visible, and cannot be silently upgraded to Pass/Conditional/Fail. |
| D5 | Any rule derived from `Partial Extract` or `Version Unverified` sources is advisory-only, with an explicit warning label — not usable for certification decisions. |

---

## 10. Dashboard Views — Design Specifications

### 10.1 Executive View
- One-page summary card per site: certification status, top 3 risks, top 3 actions, next verification date.
- Risk traffic-light colour coding (Pass = green, Conditional = amber, Fail = red, Insufficient Evidence = grey).
- Time to comprehend top risks: ≤5 minutes target.

### 10.2 Operations View
- Alert Center: sortable, filterable list of all open parameter breaches across sites.
- Columns: Site, Zone, Parameter, Current Value, Threshold, Status, Owner, Due Date, Days Open.
- Intervention Tracker: before/after reading cards with confidence label and confounder notes.
- Cross-site comparison table: sites ranked by worst IAQ parameter.

### 10.3 Analyst View
- Upload queue and parse validation status.
- Findings panel per metric: value, threshold band, rule interpretation, citation, confidence, action priority.
- Report draft builder with QA checklist gate.
- Source currency status badge on each citation.

### 10.4 Customer Portal View (Phase 3)
- Certification status card: Pass / Conditional / Fail / Insufficient Evidence.
- Corrective action tracker (view only — customers cannot modify thresholds or findings).
- Next renewal date and recertification workflow prompt.
- Legal/medical disclaimer prominently displayed.

---

## 11. Data Model — Dashboard Layer

The FJDashboard reads from the following core entities (defined in FJ SafeSpace PRD v0.4 and Reference Vault/Rulebook Schema v1.0):

| Entity | Key Fields Used by Dashboard |
|---|---|
| **Site Reading** | `site_name`, `zone`, `device_id`, `timestamp`, `metric_name`, `value`, `unit` |
| **Finding** | `threshold_band`, `interpretation_text`, `action_priority`, `confidence_level` |
| **Rulebook Entry** | `rule_id`, `rule_version`, `citation_unit_ids[]`, `approval_status` |
| **Citation Unit** | `citation_unit_id`, `source_id`, `exact_excerpt`, `extraction_confidence` |
| **Reference Source** | `source_id`, `title`, `status` (active / superseded), `source_currency_status` |
| **Alert** | `parameter`, `site`, `zone`, `owner`, `due_date`, `closure_status` |
| **Intervention** | `before_snapshot`, `after_snapshot`, `confidence_label`, `confounder_notes`, `rule_citation` |
| **Report** | `report_version`, `rule_version_used`, `citation_ids_used`, `reviewer_sign_off` |

---

## 12. KPI Framework (Dashboard-Specific)

### Operational KPIs
- Time-from-upload to dashboard update (target: <2 hours, Phase 2).
- Alert resolution rate (% of alerts closed within due date).
- Intervention tracker coverage (% of interventions with before/after pairs logged).

### Quality KPIs
- % dashboard findings with complete `rule_version` + `citation_id`.
- % findings with `Partial Extract` / `Version Unverified` sources correctly labelled as advisory-only.
- QA checklist pass rate before report approval.

### Customer Value KPIs
- Executive comprehension time (≤5 minutes target, measured in user testing).
- Customer portal certification status accuracy (matches reviewer-approved outcome 100%).
- Renewal conversion rate (Phase 3).

---

## 13. Phase Gates

### Gate 1 → 2 (Phase 1 to Phase 2 unlock)
- ≥10 assessments processed through the upload + findings pipeline.
- ≥95% parse success rate.
- Evidence citation completeness ≥95%.
- Analyst dashboard reviewed and signed off internally.

### Gate 2 → 3 (Phase 2 to Phase 3 unlock)
- uHoo API feasibility validated.
- Security/auth design and tenant isolation approved.
- Support model for customer access defined.
- Legal/medical disclaimer wording approved by designated authority.
- Executive dashboard ≤5-minute comprehension target validated in dry-run (NPE and CAG sites).

---

## 14. Reporting Upgrade Requirements (From Section 25.5)

Applies to any report surfaced through or linked from the dashboard:
- Mandatory **one-page Executive Brief** at report front.
- Each parameter block must include: current reading, benchmark lane (SS554 / BCA / WELL), status, business meaning, action, owner, due date.
- Mandatory **confidence and causality note** for all intervention claims.
- Mandatory **data quality statement** (uptime gaps, outlier handling, impact on confidence).

---

## 15. Risk Register

| ID | Risk | Mitigation |
|---|---|---|
| R1 | uHoo API uncertainty (rate limits, auth) | API discovery sprint before Phase 3 commitment |
| R2 | Dashboard scoring trust (user disbelief) | Publish logic dictionary; surface rule/citation on every card |
| R3 | Scope creep into non-IAQ domains | Enforce out-of-scope list; no feature ships without PRD alignment |
| R4 | Legal/claim risk (causality language) | Approved language policy enforced via QA checklist gate |
| R5 | Source currency drift (standards become outdated) | Quarterly OfficialStack refresh cycle + critical-update fast path |

---

## 16. Success Criteria for Product Excellence (Section 25.6)

- 100% of reports generated through dashboard use standardised template structure.
- 100% of certification-impact findings include `rule_version` + `citation_id`.
- ≤5 minutes for executive stakeholder to identify risks and required actions.
- NPE and CAG dry-run outputs both pass the upgraded QA gate.

---

## 17. Approval Gate

The FJDashboard product release is **complete only after Jay Choy sign-off** on:
1. This PRD (FJDashboard v1.1).
2. Dashboard design and role-view specifications.
3. Report template v2 (Executive Brief + parameter blocks).
4. NPE/CAG dry-run evidence demonstrating parity + FJ differentiation requirements met.

---

## 18. Open Questions

> [!NOTE]
> All open questions resolved and locked on 2026-04-11 by Jeff. Decisions recorded in Section 19.

| # | Question | Owner | Status |
|---|---|---|---|
| OQ1 | Customer-facing label for the IAQ/wellness score | Jeff / Jay Choy | ✅ Locked — see Decision Log |
| OQ2 | Is the Intervention Tracker confounder notes field analyst-editable? | Jeff | ✅ Locked — see Decision Log |
| OQ3 | Alert notification channels in scope | Jeff | ✅ Locked — see Decision Log |
| OQ4 | Cross-site ranking method | Jeff | ✅ Locked — see Decision Log |
| OQ5 | Phase 3 minimum uptime SLA | Jeff / Jay Choy | ✅ Locked — see Decision Log |

---

## 19. Decision Log

| Decision | Rationale | Trade-off | Owner | Date | Revisit Trigger |
|---|---|---|---|---|---|
| Role-based modes: Executive / Operations / Analyst | Different personas need radically different information density | More build complexity | Jeff | 2026-04-11 | If user research reveals persona overlap |
| Insufficient Evidence surfaced visibly | FJ differentiator; prevents false certification signals | May confuse users unfamiliar with evidence grading | Jeff / Jay Choy | 2026-04-11 | Never for compliance; revisit labelling wording only |
| No manual threshold override | Core governance control; certification defensibility | Reduces analyst flexibility | Jay Choy | 2026-04-08 (locked) | Never |
| **[OQ1 ✅] Customer-facing score label: "Space Health Rating"** | Avoids NEA AQI confusion; non-clinical; legally safe; pairs cleanly with Pass / Conditional / Fail / Insufficient Evidence states | None identified | Jeff | 2026-04-11 | Legal/medical disclaimer review may require wording adjustment only |
| **[OQ2 ✅] Intervention Tracker confounder notes: analyst-editable pre-sign-off; read-only + audit-locked post-reviewer approval** | Preserves audit trail and certification evidence integrity; edit history logged | Analyst cannot amend notes after reviewer signs off | Jeff | 2026-04-11 | Never for post-approval lock; revisit pre-sign-off edit scope if needed |
| **[OQ3 ✅] Alert notifications: in-app + email only (all phases)** | Covers all internal roles with minimal integration complexity | No real-time push beyond email; Slack/Teams permanently out of scope | Jeff | 2026-04-11 | Revisit only if alert volume or team scale grows significantly |
| **[OQ4 ✅] Cross-site ranking: P1 breach count (primary), P2 breach count (secondary); no composite score** | Fully traceable to rule_version + citation_id; satisfies "Explainable scoring" principle; avoids black-box aggregation | Less visually compact than a single score | Jeff | 2026-04-11 | Revisit only if executive user testing shows comprehension issues |
| **[OQ5 ✅] Phase 3 uptime SLA: 99.5% at launch; roadmap to 99.9% at 12-month post-Phase 3 review** | Honest commitment for a new Phase 3 stack; planned maintenance windows excluded | Cannot promise 99.9% until stack proves stable | Jeff | 2026-04-11 | 12-month post-Phase 3 launch review |

---

*Derived from FJ SafeSpace PRD v0.4 (2026-03-30) and Product Excellence Addendum (Section 25, 2026-04-11). Parent document remains the authoritative source for platform-wide governance, certification policy, and data model definitions.*

---

## 20. Certification Policy Baseline

Decision states:
- **Pass**: meets required threshold bands and evidence completeness
- **Conditional**: minor gaps; corrective actions required with a due date
- **Fail**: significant threshold breaches or insufficient evidence
- **Insufficient Evidence**: no valid applicable rule set for context/metric — outcome blocked; cannot be upgraded until rulebook support exists

Governance:
- Certification decisions require final sign-off by Jay Choy (sole approver; no delegation path)
- Renewal interval: annual (default), with interim checks if needed

Minimum evidence pack (mandatory for Pass / Conditional / Fail):
- Raw input identifiers (file names + assessment ID + sampling window)
- Rulebook version used
- Citation IDs for all non-obvious findings
- Corrective action status (if Conditional/Fail)
- Reviewer QA checklist completion
- Final approver sign-off record

---

## 21. Platform Dependencies

- uHoo export samples and API documentation
- Approved mapping matrix and standards references
- Branding and disclaimer text (approved legal/medical wording required before production release)
- Reviewer availability for the sign-off process

---

## 22. Milestone Plan

| Milestone | Timeline | Deliverable |
|---|---|---|
| M1 | Week 1–2 | Upload schema + parser + rule table |
| M2 | Week 3–4 | Findings engine + report v1 + QA checklist |
| M3 | Week 5–6 | Dashboard v2 internal + trend views |
| M4 | Post-feasibility | API integration and customer portal prep |

---

## 23. Standards Governance Model

- Product scope includes a Reference Vault, ingestion pipeline, review queue, and approved Rulebook DB.
- Report outputs must include citation IDs and rule version used for each non-obvious claim.
- RAG is advisory only; Rulebook remains the runtime source of truth for thresholds and compliance framing.
- Decision model is strictly rule-based; no expert override path in current operating model.
- SLA measurement starts at analyst upload time (not last sensor reading time).
- Final approval authority is Jay Choy only for: rule changes, customer report release, and certification outcomes.

---

## 24. Dual Workflow Operating Model (Locked 2026-04-08)

### Workflow A — Standards and Reference Governance

Purpose: Maintain an accurate and auditable Rulebook.

Steps:
1. Ingest raw standards/research documents into Reference Vault.
2. Extract candidate clauses, thresholds, and applicability context.
3. Perform human review and approval.
4. Publish approved Rulebook version (vX.Y).
5. Mark superseded rule versions while preserving history.

Outputs:
- Approved Rulebook version
- Citation registry and change log
- Effective date mapping for rule versions

### Workflow B — Scan-to-Report Operations

Purpose: Generate customer-ready IAQ reports from scan data.

Steps:
1. Upload uHoo readings (CSV/export).
2. Validate and normalise readings.
3. Evaluate against current approved Rulebook only.
4. Generate findings, actions, and citations.
5. Reviewer QA and sign-off.
6. Export final report with audit metadata.

Outputs:
- Customer report
- Rulebook version used
- Citation IDs used
- Reviewer sign-off record

### Separation-of-Duties Rule
- Workflow B cannot create or modify thresholds.
- Rule changes can only occur via Workflow A governance path.
- Missing citations block report approval.

---

## 25. OfficialStack Source Currency Policy (2026-04-11)

- OfficialStack is the designated source pack for standards pinning, but some files may be preview-only, excerpt-only, or not the latest release.
- Rulebook outputs must carry a Source Currency Status field per source: `Current Verified / Partial Extract / Version Unverified / Superseded`.
- Any rule derived from Partial Extract or Version Unverified sources is allowed for advisory reporting only with explicit warning labels, and cannot be used for certification decisions.
- Maintain a quarterly source-refresh cycle for OfficialStack and a critical-update fast path when standards are amended.
- Release gate: if an active certification rule depends on a source marked Partial Extract or Version Unverified, outcome must be downgraded to Insufficient Evidence until full/latest source is pinned.
- No manual threshold override is allowed under any circumstance in production report generation or certification decisions.

---

## Appendix A — Standards Ingestion and Governance Pipeline

### Purpose
Define the operational workflow to keep standards current and report logic trustworthy.

### Pipeline Stages

**Stage 1: Intake**
- Add raw document to Reference Vault.
- Register metadata (version, publisher, URL, checksum).

**Stage 2: Extraction**
- Parse document into citation units.
- Tag candidate metrics and thresholds.
- Mark low-confidence extracts for manual review.

**Stage 3: Review**
- Reviewer validates excerpt accuracy.
- Reviewer confirms applicability context.
- Reviewer assigns confidence and approval notes.

**Stage 4: Rule Drafting**
- Convert approved citation units into proposed rules.
- Attach interpretation and recommendation templates.

**Stage 5: Approval and Publish**
- Approver signs off rule version.
- Rule is promoted to runtime Rulebook.
- Superseded rules stay archived but queryable.

**Stage 6: Monitoring**
- Track source updates quarterly.
- Trigger re-ingestion when new editions are detected.

### Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Intake Owner | Captures source and metadata |
| Reviewer | Validates extraction and applicability |
| Approver | Signs off production rule changes |
| Product Owner | Confirms business-language policy |

### SLAs

| Task | SLA |
|---|---|
| New source intake | Within 3 business days |
| Extraction review | Within 5 business days |
| Critical standard update publish | Within 7 business days |

### Release Gates
- Gate A: source metadata complete
- Gate B: citation accuracy verified
- Gate C: rule impact assessed
- Gate D: approval sign-off complete

### Risk Controls
- No auto-publish from extraction to production.
- No threshold change without diff + sign-off.
- No customer report release with unresolved citation gaps.

---

## Appendix B — Reference Vault and Rulebook Schema

### Reference Vault Schema (Raw Source)

| Field | Description |
|---|---|
| source_id | Unique identifier |
| title | Document title |
| publisher | Issuing body |
| source_type | standard / guideline / whitepaper / vendor |
| jurisdiction | SG / global / etc. |
| url | Source URL |
| file_storage_uri | Stored file path |
| checksum | File integrity hash |
| version_label | Source version string |
| published_date | Publication date |
| effective_date | Effective date |
| ingested_at | Ingestion timestamp |
| status | active / superseded / retired |

### Extracted Citation Unit Schema

| Field | Description |
|---|---|
| citation_unit_id | Unique identifier |
| source_id | Parent source reference |
| page_or_section | Location in source document |
| exact_excerpt | Verbatim extracted text |
| metric_tags[] | Associated metrics |
| condition_tags[] | Context tags |
| extracted_threshold_value | Numeric threshold if present |
| extracted_unit | Unit of measurement |
| extraction_confidence | Confidence score |
| extractor_version | Extractor version used |
| needs_review | Boolean — manual review required |

### Rulebook Schema (Approved Runtime)

| Field | Description |
|---|---|
| rule_id | Unique identifier |
| metric_name | IAQ metric |
| threshold_type | range / upper_bound / lower_bound |
| min_value | Lower bound |
| max_value | Upper bound |
| unit | Measurement unit |
| context_scope | office / industrial / school / residential / etc. |
| interpretation_template | Plain-language interpretation |
| business_impact_template | Workforce/business impact phrasing |
| recommendation_template | Corrective action guidance |
| priority_logic | P1 / P2 / P3 |
| citation_unit_ids[] | Supporting citation references |
| confidence_level | high / medium / low |
| rule_version | Semver rule version |
| effective_from | Effective date |
| effective_to | Expiry date (null if current) |
| approval_status | draft / approved / superseded |
| approved_by | Approver name |
| approved_at | Approval timestamp |

### Versioning and Change Control
- New source edition does not overwrite old entries.
- Old rules remain queryable with superseded status.
- New rule versions require approver sign-off.
- Every report stores rule_version and citation_unit_ids used.

### Runtime Guardrails
- Report scoring can only use approved Rulebook records.
- RAG can suggest context but cannot set thresholds directly.
- Missing citation blocks final report approval.

---

*This document (FJDashboard_PRD.md) supersedes PRD.md (FJ SafeSpace PRD v0.4, 2026-03-30) and serves as the consolidated platform + dashboard PRD from 2026-04-11.*
