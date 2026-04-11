FJ SafeSpace - Product Requirements Document (PRD) v0.4
Detailed Anti-Drift Version
Date: 2026-03-30
Owner: Jeff
PM: Lyra
Status: Draft for Review (v0.4 correction pass)
 
0. Document Control

Purpose: Create a single source of truth to avoid scope drift during the dashboard and certification product build.
Review cadence: weekly (every Monday)
Change control: Any change to the scope, KPI definitions, or certification logic requires an update to the decision log.
Approval authority lock-in: Jay Choy is the final approver for threshold/rule changes, customer report release, and certification outcomes.
Operational SLA lock-in: Customer report release target is within 48 hours from analyst upload time.
Legal/compliance gate: Production customer release is blocked until legal/medical disclaimer wording is approved.
1. Product Objective

Build a web-based internal-first platform that converts uHoo IAQ readings into:
Layman-friendly dashboard insights,
Research/standard-mapped findings reports, and
Annual renewable certification decisions with auditable evidence.
2. Problem Statement

FJ can collect IAQ data, but interpretation and reporting are not yet standardised enough for repeatable customer delivery and scalable certification operations.
3. Outcome Definition (What Success Looks Like)

Business outcomes:
Faster turnaround from scan to customer report
Higher trust via transparent evidence mapping
Repeatable certification workflow for annual renewals
 
Product outcomes:
Analysts can generate consistent reports from uploaded scan data
Non-technical stakeholders can understand the dashboard within 5 minutes
All major findings include traceable evidence references
 
4. Personas

Internal Analyst
Needs: quick data upload, auto interpretation, editable report draft
Pain: manual inconsistency and slow report production
Internal Reviewer/Approver
Needs: audit trail, confidence labels, QA checklist
Pain: unclear rationale behind recommendations
Customer Decision Maker
Needs: Simple status, actionable next steps, certification status
Pain: Raw IAQ numbers are hard to interpret
5. Scope Boundaries

In Scope
uHoo scan ingestion (upload first)
Rule-based findings generation
Evidence-mapped report generation
Certification decision workflow (pass/conditional/fail)
 
Out of Scope (current cycle)
Guaranteeing direct medical causality
Broad IoT/BMS control automation
Open customer self-service in Phase 1/2 (customer-facing access starts only after gates are met)
 
6. Product Principles (Anti-Drift Guardrails)

Evidence before aesthetics
Explainable scoring over black-box scoring
Internal reliability before customer exposure
Versioned logic (reproducibility)
 
7. Functional Requirements by Phase

Phase 1: Upload + Findings + Report (Internal)
FR1. Upload module accepts a defined schema (CSV/PDF export)
FR2. Parser normalises units/time and flags missing fields
FR3. Rules engine maps metrics to threshold bands
FR4. Findings composer generates plain-language interpretation
FR5. Report builder outputs branded report draft
FR6. The reviewer can edit and finalise with an approval stamp
FR7. All findings include evidence source references
Phase 2: Internal Dashboard v2
FR8. Dashboard summary cards by site/zone/time window
FR9. Trend visualisation (pre/post intervention)
FR10. Critical parameter alerts and recommended action queue
FR11. Report version history and comparison view
Phase 3: Live Dashboard + Customer Access
FR12. uHoo API ingestion (polling/webhook per feasibility)
FR13. Role-based authentication and tenant data separation
FR14. Customer portal view with certification status
FR15. Renewal reminders and recertification workflow
 
8. Non-Functional Requirements

NFR1. Reproducibility: same input + same rule version => same output
NFR2. Traceability: each finding linked to a rule and a reference source
NFR3. Performance: report draft generation <2 min (Phase 1 target)
NFR4. Security: internal-only access for Phase 1/2
NFR5. Availability target (Phase 3): defined after API feasibility
 
9. Data & Evidence Model (v1)

Core fields:
site_name, zone, device_id, timestamp
metric_name, value, unit
threshold_band, interpretation_text
source_reference, confidence_level
action_priority, reviewer_status
 
Evidence policy:
Any non-obvious claim must cite at least one approved source
Productivity impact language must be “indicator-based” (not deterministic claims)
 
10. KPI Framework

Operational KPIs
TAT: scan-to-report time
Report release SLA compliance (<=48 hours from analyst upload time)
Parse success rate
Reviewer rework rate
 
Quality KPIs
Findings are consistent across analysts
Evidence citation completeness
QA checklist pass rate
 
Customer Value KPIs
Comprehension score of the report/dashboard
Intervention adoption rate
Renewal rate
11. Certification Policy Baseline

Decision states:
Pass: meets required threshold bands and evidence completeness
Conditional: minor gaps; corrective actions required with due date
Fail: significant threshold breaches or insufficient evidence
 
Governance:
Certification decisions require final sign-off by Jay Choy (sole approver; no delegation path).
Renewal interval: annual (default), with interim checks if needed
 
Minimum evidence pack (mandatory for Pass/Conditional/Fail):
- Raw input identifiers (file names + assessment ID + sampling window)
- Rulebook version used
- Citation IDs for all non-obvious findings
- Corrective action status (if Conditional/Fail)
- Reviewer QA checklist completion
- Final approver sign-off record
 
12. Risk Register (Top)

R1 API uncertainty (uHoo capabilities/rate limits/auth)
Mitigation: API discovery sprint before Phase 3 commitment
R2 Scoring trust risk
Mitigation: publish logic dictionary + reference citations
R3 Scope creep
Mitigation: strict phase gates and out-of-scope list enforcement
R4 Legal/claim risk
Mitigation: approved language policy and review checklist
 
13. Dependencies

uHoo export samples and API documentation
Approved mapping matrix and references
Branding + disclaimer text (approved legal/medical wording required before production release)
Reviewer availability for the sign-off process
14. Phase Gates (No-Go/Go Criteria)

Gate 1->2 (must pass all):
>=10 assessments processed through the tool
>=95% parse success
Evidence completeness >=95%
 
Gate 2->3 (must pass all):
uHoo API feasibility validated
Security/auth design approved
Support model for customer access defined
Legal/medical disclaimer wording approved
15. Milestone Plan (Draft)

M1 (Week 1-2): upload schema + parser + rule table
M2 (Week 3-4): findings engine + report v1 + QA checklist
M3 (Week 5-6): dashboard v2 internal + trend views
M4 (Post-feasibility): API integration and customer portal prep
16. Decision Log (Template)

Decision
Rationale
Trade-off
Owner
Date
Revisit trigger
17. Open Questions

Final threshold ownership: locked to standards governance workflow with final approval by Jay Choy.
Minimum certification evidence pack definition?
Customer-facing terminology for wellness score?
18. Immediate Next Actions

Lock upload schema and sample files
Build rule dictionary v0.1 (metric -> threshold -> meaning -> action -> source)
Finalise report sections and disclaimer language
Run 2 pilot assessments end-to-end and capture gaps
 
 
19. Standards Governance Addendum (2026-04-08)

● Product scope includes a Reference Vault, ingestion pipeline, review queue, and approved Rulebook DB.
● Report outputs must include citation IDs and rule version used for each non-obvious claim.
● RAG is advisory only; Rulebook remains the runtime source of truth for thresholds and compliance framing.
 
 
 
20. Appendix A - Standards Ingestion and Governance Pipeline

FJ SafeSpace - Standards Ingestion and Governance Pipeline v1.0
Date: 2026-04-08
Owner: Jeff
PM: Lyra
Status: Active Draft
 
0. Document Control

Purpose: Define operational workflow to keep standards current and report logic trustworthy.
 
1. Pipeline Stages

1.1 Intake

Add raw document to Reference Vault.
Register metadata (version, publisher, URL, checksum).
 
1.2 Extraction

Parse document into citation units.
Tag candidate metrics and thresholds.
Mark low-confidence extracts for manual review.
 
1.3 Review

Reviewer validates excerpt accuracy.
Reviewer confirms applicability context.
Reviewer assigns confidence and approval notes.
 
1.4 Rule Drafting

Convert approved citation units into proposed rules.
Attach interpretation and recommendation templates.
 
1.5 Approval and Publish

Approver signs off rule version.
Rule is promoted to runtime Rulebook.
Superseded rules stay archived but queryable.
 
1.6 Monitoring

Track source updates quarterly.
Trigger re-ingestion when new editions are detected.
 
2. Roles and Responsibilities

Intake Owner: captures source and metadata.
Reviewer: validates extraction and applicability.
Approver: signs off production rule changes.
Product Owner: confirms business-language policy.
 
3. SLAs

New source intake: within 3 business days.
Extraction review: within 5 business days.
Critical standard update publish: within 7 business days.
 
4. Release Gates

Gate A: source metadata complete.
Gate B: citation accuracy verified.
Gate C: rule impact assessed.
Gate D: approval sign-off complete.
 
5. Risk Controls

No auto-publish from extraction to production.
No threshold change without diff + sign-off.
No customer report release with unresolved citation gaps.
 
6. PRD and PSD Impact

PRD: update product scope to include Reference Vault + rule governance as core capability.
PSD-01: add integration fields for rule_version and citation IDs in report generation.
PSD-02/03: include ingestion services, review UI, and admin tooling.
 
7. Next Actions

1) Add these components to roadmap and backlog.
2) Add governance checklist to report release process.
3) Define first approver group for rule changes.
 
 
 
21. Appendix B - Reference Vault and Rulebook Schema

FJ SafeSpace - Reference Vault and Rulebook Schema v1.0
Date: 2026-04-08
Owner: Jeff
PM: Lyra
Status: Active Draft
 
0. Document Control

Purpose: Define the data architecture for standards ingestion and app-safe rulebook publishing.
Scope: Applies to source document storage, extraction pipeline, review workflow, and report runtime citations.
 
1. Architecture Overview

Layer 1: Reference Vault (raw source repository)
Layer 2: Ingestion Pipeline (parse and extract candidate rules)
Layer 3: Review Queue (human validation)
Layer 4: Rulebook DB (approved runtime truth)
Layer 5: Report Engine (citation-enforced output)
 
2. Reference Vault Schema (Raw Source)

source_id (unique)
title
publisher
source_type (standard, guideline, whitepaper, vendor)
jurisdiction (SG, global, etc.)
url
file_storage_uri
checksum
version_label
published_date
effective_date
ingested_at
status (active, superseded, retired)
 
3. Extracted Citation Unit Schema

citation_unit_id
source_id
page_or_section
exact_excerpt
metric_tags[]
condition_tags[]
extracted_threshold_value
extracted_unit
extraction_confidence
extractor_version
needs_review (bool)
 
4. Rulebook Schema (Approved Runtime)

rule_id
metric_name
threshold_type (range, upper_bound, lower_bound)
min_value
max_value
unit
context_scope (office, industrial, school, etc.)
interpretation_template
business_impact_template
recommendation_template
priority_logic (P1, P2, P3)
citation_unit_ids[]
confidence_level
rule_version
effective_from
effective_to
approval_status (draft, approved, superseded)
approved_by
approved_at
 
5. Versioning and Change Control

New source edition does not overwrite old entries.
Old rules remain queryable with superseded status.
New rule versions require approver sign-off.
Every report stores rule_version and citation_unit_ids used.
 
6. Runtime Guardrails

Report scoring can only use approved Rulebook records.
RAG can suggest context but cannot set thresholds directly.
Missing citation blocks final report approval.
 
7. Minimum API Contracts

7.1 Ingestion API

input: source_id + file
output: extracted citation units + review tasks
 
7.2 Rule Publish API

input: reviewed citation units + proposed rule
output: approved rule_version
 
7.3 Report API

input: site readings + context
output: findings + citations + rule versions
 
8. Initial Metric Set (Phase 1)

CO2
PM1
PM2.5
PM10
Temperature
Relative Humidity
TVOC
 
9. QA and Audit Requirements

Full provenance from report claim back to source excerpt.
Diff log for every rule change.
Monthly review of superseded/active source set.
 
10. Next Actions

1) Implement Reference Vault metadata table.
2) Implement Citation Unit extraction format.
3) Build Rulebook approval workflow.
4) Connect report template to rule/citation IDs.
 
 
 
22. Dual Workflow Operating Model (Locked 2026-04-08)

 
22.1 Workflow A - Standards and Reference Governance

Purpose: Maintain an accurate and auditable Rulebook.
Steps:
- Ingest raw standards/research documents into Reference Vault.
- Extract candidate clauses, thresholds, and applicability context.
- Perform human review and approval.
- Publish approved Rulebook version (vX.Y).
- Mark superseded rule versions while preserving history.
 
Outputs:
- Approved Rulebook version
- Citation registry and change log
- Effective date mapping for rule versions
 
22.2 Workflow B - Scan-to-Report Operations

Purpose: Generate customer-ready IAQ reports from scan data.
Steps:
- Upload uHoo readings (CSV/export).
- Validate and normalise readings.
- Evaluate against current approved Rulebook only.
- Generate findings, actions, and citations.
- Reviewer QA and sign-off.
- Export final report with audit metadata.
 
Outputs:
- Customer report
- Rulebook version used
- Citation IDs used
- Reviewer sign-off record
 
22.3 Separation-of-Duties Rule

- Workflow B cannot create or modify thresholds.
- Rule changes can only occur via Workflow A governance path.
- Missing citations block report approval.
 
 
23. Governance and Decision Quality Lock-In (2026-04-08)
- SLA measurement starts at analyst upload time (not last sensor reading time).
- Final approval authority is Jay Choy only for: rule changes, customer report release, and certification outcomes.
- Decision model is strictly rule-based; no expert override path in current operating model.
- MVP scope includes mixed premises, including residential.
- If rule applicability is insufficient for a context, outcome must be marked "Insufficient Evidence" and cannot be upgraded to Pass/Conditional/Fail until rulebook support exists.
- Production release remains blocked until legal/medical disclaimer wording is approved.
 
 
24. OfficialStack Source Currency Policy (2026-04-11)
- OfficialStack is the designated source pack for standards pinning, but some files may be preview-only, excerpt-only, or not the latest release.
- Therefore, Rulebook outputs must carry a Source Currency Status field per source: {Current Verified / Partial Extract / Version Unverified / Superseded}.
- Any rule derived from Partial Extract or Version Unverified sources is allowed for advisory reporting only with explicit warning labels, and cannot be used for certification decisions.
- PRD governance requirement: maintain a quarterly source-refresh cycle for OfficialStack (PhaseA/PhaseB/PhaseC) and a critical-update fast path when standards are amended.
- Release gate: if an active certification rule depends on a source marked Partial Extract or Version Unverified, outcome must be downgraded to Insufficient Evidence until full/latest source is pinned.
 
No manual threshold override is allowed under any circumstance in production report generation or certification decisions.
 
 
25. Product Excellence Addendum
 
25.1 Objective
Advance product and reporting quality to best-in-class standards while preserving FJ differentiators (traceability, rule governance, and certification defensibility).
 
25.2 Gap Closure Scope
In scope:
- Dashboard product parity for operations and management visibility
- Reporting structure upgrades for executive readability and actionability
- Intervention tracking and before/after impact framing
- Multi-site comparison and alert workflow
 
Out of scope:
- Non-IAQ categories outside current certification scope
- Any feature that weakens rule/citation governance controls
 
25.3 Product Parity Requirements (Must-Have)
- Role-based dashboard modes: Executive, Operations, Analyst
- Views: Site, Zone/Floor, Cross-site comparison, Critical parameter queue
- Alert Center: failed parameter list with owner, due date, and closure status
- Intervention Tracker: before/after snapshots with confidence labels and confounder notes
- Daily summary card: top 3 risks, top 3 actions, verification due date
 
25.4 FJ Differentiation Requirements (Must Retain)
- Every finding traceable to rule_version + citation_id
- Source currency status visible in report metadata
- No manual threshold override under any circumstance
- Insufficient Evidence state preserved and user-visible
 
25.5 Reporting Upgrade Requirements
- Mandatory one-page Executive Brief at report front
- Parameter blocks must include: current reading, benchmark lane (SS554/BCA/WELL), status, business meaning, action, owner, due date
- Mandatory confidence and causality note for intervention claims
- Mandatory data quality statement (uptime gaps, outlier handling, and impact on confidence)
 
25.6 Success Criteria for Gap Closure
- 100% reports generated in standardized template structure
- 100% certification-impact findings include rule/citation metadata
- <=5 minutes for executive stakeholder to identify risks and required actions
- NPE and CAG dry-run outputs both pass the upgraded QA gate
 
25.7 Approval Gate
Product excellence package is complete only after Jay Choy sign-off on:
- PRD/PSD updates
- Report template v2
- NPE/CAG dry-run evidence of parity + differentiation
 