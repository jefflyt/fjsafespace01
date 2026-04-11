FJ SafeSpace - Product Specification Document (PSD-01) v0.3
Formatted + Copywriting Pass
Scope: Phase 1 (Upload + Findings + Report)
Date: 2026-03-31
Owner: Jeff
PM: Lyra
Status: Draft for Review
 
0. Document Control

Purpose: Provide build-ready implementation detail for Phase 1 with minimal ambiguity.
Source of truth: This document governs Phase 1 scope, data contract, and acceptance criteria.
Change control: Any change to schema, rules, or approval workflow requires version bump and decision-log entry.
 
1. Objective

Deliver an internal web tool that ingests uHoo scan exports and produces:
standardised findings,
evidence-linked interpretation, and
reviewer-approved customer report drafts.
 
2. Scope Boundaries

In Scope
Manual upload of uHoo exports (CSV first)
Parsing, validation, normalisation
Rule-based findings generation
Citation-aware report generation
Internal review and approval workflow
 
Out of Scope (Phase 1)
Live API ingestion
Customer login/portal
External sharing automation
 
3. End-to-End Workflow

Upload -> Validate -> Normalise -> Evaluate Rules -> Compose Findings -> Generate Report Draft -> Reviewer Approval -> Final Export
 
4. Upload Data Contract (Schema v1)

4.1 Supported file types

CSV (required)
XLSX (optional, if parser profile is enabled)
PDF export (manual mapping only unless parser profile is approved)
 
4.2 Required columns

site_name (string)
zone_name (string)
device_id (string)
reading_timestamp (ISO8601 or parseable datetime)
metric_name (normalised enum)
metric_value (number)
metric_unit (string)
 
4.3 Optional columns

floor_level (string)
occupancy_context (string)
sampling_duration_min (number)
note (string)
 
4.4 Normalised metric enum (v1)

co2_ppm
pm25_ugm3
tvoc_ppb
temperature_c
humidity_rh
 
5. Validation + Normalisation Rules

Reject rows with missing required fields.
Reject rows with non-numeric metric_value.
Reject timestamps beyond +5 minutes server time.
Warn (do not fail) on physically implausible outliers.
Convert mixed units into canonical units before rule evaluation.
 
6. Parse Outcome States

PASS: All required checks succeed.
PASS_WITH_WARNINGS: Upload accepted with non-blocking anomalies.
FAIL: Structural or required-field issues exceed policy threshold.
 
7. Rules Engine Contract

Each rule record includes:
rule_id
metric_name
band (good/watch/critical)
min_value, max_value
interpretation_template
workforce_impact_template
recommended_action_template
source_ref_ids[]
confidence_level (high/medium/low)
rule_version
 
Determinism requirement:
Given identical input + identical rule_version, outputs must be identical.
 
8. Findings Composition Logic

Output levels:
Metric-level finding
Zone-level summary
Site-level executive summary
 
Priority labels:
P1: Critical risks or sustained adverse patterns
P2: Moderate concern requiring planned intervention
P3: Optimisation opportunities
 
Language policy:
Use indicator phrasing ("may indicate", "is associated with").
Avoid deterministic medical causality claims.
 
9. Citation + Evidence Policy

Any non-obvious claim must include at least one approved source reference.
Missing citation blocks report approval.
All source entries must be versioned and reviewable.
 
10. Report Specification (v1)

Required sections:
1) Cover (site, date, assessment ID, version)
2) Executive Summary (layman-friendly)
3) IAQ Findings by zone
4) Occupant/workforce implication (indicator-based)
5) Recommended actions (P1/P2/P3)
6) Standards and research references
7) Limitations + disclaimer
8) Next verification recommendation
 
Report metadata:
report_id
generated_at
rules_version
reviewer_name
reviewer_status
 
Export:
PDF (required)
JSON archive (optional internal)
 
11. Reviewer Workflow

States:
draft_generated
in_review
revision_required
approved
exported
 
Reviewer controls:
Edit narrative blocks
Accept/reject flagged findings
Resolve citation exceptions
Approve with name + timestamp
 
12. UX Requirements (Internal)

Upload page with schema validator
Summary cards for quick triage
Technical drill-down table (raw + normalised)
Findings panel with traceable citations
Report preview and approval actions
 
13. Non-Functional Requirements

Performance: report draft generation <2 minutes per upload
Reliability: parser crash rate <1%
Security: internal-only access (Phase 1)
Auditability: complete change and approval log
Reproducibility: strict rule versioning
 
14. Acceptance Criteria (Phase 1 Go/No-Go)

AC1: 10 sample uploads processed end-to-end
AC2: Parse success >=95%
AC3: Citation completeness >=95% where required
AC4: Reviewer approval flow functional end-to-end
AC5: Stable export for all defined test cases
 
15. Minimum Test Plan

Happy-path upload
Missing-column failure
Invalid-unit normalisation
Outlier warning handling
Multi-zone summary generation
Citation-missing approval block
Revision and re-approval cycle
 
16. Risks + Mitigations

Input-format drift -> versioned parser profiles
Inconsistent interpretation -> template controls + reviewer QA
Trust erosion from unclear claims -> mandatory citations and disclaimer policy
 
17. Next Actions

1) Lock schema v1 and sample files
2) Freeze rule table v0.1 for pilot
3) Finalise disclaimer language
4) Run 2–3 pilot assessments and capture defects
 
 
18. Standards Integration Addendum (2026-04-08)

● Report generator must persist rule_version and citation_unit_ids for each finding block. SLA timestamp anchor = analyst_upload_time.
● Missing citation data must block reviewer approval state transition to approved.
● Phase 1 implementation should prepare schema hooks for future ingestion services without requiring redesign.
 
 
 
19. Appendix A - Rule Dictionary

FJ SafeSpace - Rule Dictionary v0.2
Formatted + Copywriting Pass
Scope: Phase 1 Core Metrics
Date: 2026-03-31
Owner: Jeff
PM: Lyra
Status: Draft for Technical/Clinical Review
 
0. Document Control

Purpose: Define the rule logic used by Findings Engine v1.
Usage: This dictionary governs threshold bands, interpretation language, and recommended actions.
Change control: Any threshold change requires version bump, rationale, and approver sign-off.
 
1. Important Notes

Thresholds below are draft working values for implementation scaffolding.
Final production values must be approved before customer-facing release.
Wording remains indicator-based to avoid over-claiming medical certainty.
 
2. Rule Record Schema

rule_id
metric_name
band (good/watch/critical)
min_value
max_value
unit
interpretation_template
workforce_impact_template
recommended_action_template
source_ref_ids[]
confidence_level
rule_version
 
3. Core Metrics (v1)

3.1 CO2 (co2_ppm)

Good: 0–800 ppm
Interpretation: Ventilation appears adequate for current occupancy.
Workforce impact: Conditions generally support comfort and concentration.
Action: Maintain current ventilation and monitoring routine.
Confidence: high
 
Watch: >800–1200 ppm
Interpretation: Ventilation may be suboptimal during parts of occupancy.
Workforce impact: May be associated with lower perceived freshness and focus.
Action: Increase fresh air exchange; review occupancy density and HVAC scheduling.
Confidence: medium
 
Critical: >1200 ppm
Interpretation: Ventilation is likely inadequate for current operating conditions.
Workforce impact: May indicate elevated risk of discomfort and reduced cognitive effectiveness.
Action: Trigger immediate ventilation correction and reassessment.
Confidence: high
 
3.2 PM2.5 (pm25_ugm3)

Good: 0–12 ug/m3
Interpretation: Fine particulate levels are in a lower-risk operating range.
Workforce impact: Supports healthier breathing conditions indoors.
Action: Maintain filtration and source-control practices.
Confidence: medium
 
Watch: >12–35 ug/m3
Interpretation: Particulate concentration is elevated and should be managed.
Workforce impact: May be associated with irritation in sensitive occupants.
Action: Inspect filters, airflow, and pollutant sources; apply mitigation.
Confidence: medium
 
Critical: >35 ug/m3
Interpretation: Particulate burden is high and needs prompt intervention.
Workforce impact: May indicate increased respiratory stress risk.
Action: Start urgent remediation and schedule post-fix verification.
Confidence: medium
 
3.3 TVOC (tvoc_ppb)

Good: 0–500 ppb
Interpretation: VOC levels are within acceptable operating range.
Workforce impact: Lower likelihood of odour-related discomfort.
Action: Maintain source-control discipline.
Confidence: medium
 
Watch: >500–1000 ppb
Interpretation: VOC concentration is elevated and may indicate source build-up.
Workforce impact: May be associated with headache/discomfort in susceptible groups.
Action: Identify likely sources, improve ventilation, and recheck.
Confidence: low
 
Critical: >1000 ppb
Interpretation: VOC concentration is materially high and requires immediate investigation.
Workforce impact: May indicate elevated IAQ risk.
Action: Trigger immediate source mitigation and follow-up verification.
Confidence: low
 
3.4 Temperature (temperature_c)

Good: 21.0–26.0 C
Interpretation: Thermal conditions align with common workplace comfort range.
Workforce impact: Supports comfort and stable performance for most occupants.
Action: Maintain setpoint and monitor drift.
Confidence: medium
 
Watch: 18.0–<21.0 C or >26.0–28.0 C
Interpretation: Temperature is outside preferred range for part of occupancy.
Workforce impact: May be associated with reduced comfort and concentration.
Action: Tune HVAC setpoints and inspect zone imbalance.
Confidence: medium
 
Critical: <18.0 C or >28.0 C
Interpretation: Temperature is in high-discomfort territory.
Workforce impact: May indicate elevated comfort/performance risk.
Action: Apply immediate thermal correction and re-test.
Confidence: medium
 
3.5 Relative Humidity (humidity_rh)

Good: 40–60 %RH
Interpretation: Humidity is in a generally favourable indoor range.
Workforce impact: Supports comfort and moisture balance.
Action: Maintain humidity controls.
Confidence: medium
 
Watch: >30–<40 %RH or >60–70 %RH
Interpretation: Humidity is drifting from preferred operating range.
Workforce impact: May be associated with dryness/discomfort or dampness concerns.
Action: Adjust humidity control strategy and ventilation balance.
Confidence: medium
 
Critical: <=30 %RH or >70 %RH
Interpretation: Humidity is outside safe comfort-management range.
Workforce impact: May indicate higher risk of IAQ-related discomfort.
Action: Trigger immediate moisture-control intervention and follow-up scan.
Confidence: medium
 
4. Source Reference Catalog

SRC-SS554: SS 554:2016 Indoor Air Quality for Air-Conditioned Buildings (Singapore)
SRC-WELL-AIR: WELL Performance Verification Guidebook (Q4 2022)
SRC-WELL-THERMAL: WELL thermal comfort guidance within WELL PV framework
SRC-RESET-VIRAL: RESET Viral Index Whitepaper v1.1
SRC-UHOO-GUIDE: uHoo Business Essentials and related technical collateral
SRC-UHOO-VIRALINDEX: uHoo Virus Index document
 
5. Governance Rules

Every rule change requires: version increment, rationale note, approver + date.
Every report must display the rule_version used.
 
6. Open Validation Items

Confirm final CO2/TVOC policy thresholds with governance owner.
Confirm PM2.5 thresholds against selected certification pathway.
Finalise legal disclaimer language for workforce-impact section.
 
 
 
20. Appendix B - Research Mapping Annex

FJ SafeSpace - Research Mapping Annex v0.2
Formatted + Copywriting Pass
Date: 2026-03-31
Owner: Jeff
PM: Lyra
Status: Draft for Review
 
0. Document Control

Purpose: Standardise how IAQ readings are translated into evidence-backed findings.
Scope: Supports Findings Engine, report generation, and reviewer QA.
Change control: Mapping changes require version update and sign-off.
 
1. Objective

Create a consistent, auditable bridge between uHoo measurement data and approved standards/research references, using language that is accurate for non-technical audiences.
 
2. Mapping Record Structure (Required Fields)

Metric
Reading value + unit
Threshold band
Layman interpretation
Workforce impact (indicator-based)
Recommended action
Source reference(s)
Confidence level
Rule version
 
3. Language Guardrails

Use:
"is associated with"
"may indicate"
"suggests elevated risk"
 
Avoid:
deterministic medical causality claims
certainty wording without supporting evidence
 
4. Core Metric Set (Phase 1)

CO2
PM2.5
TVOC
Temperature
Relative Humidity
 
Expansion rule:
Add new metrics only after pilot consistency checks and source validation are complete.
 
5. Citation Policy

Every non-obvious finding must include at least one approved reference.
Missing citation blocks final report approval.
Citations must reference source ID and version/date where available.
 
6. Confidence Policy

High: Strong standard alignment and stable evidence support.
Medium: Reasonable support with bounded assumptions.
Low: Directional guidance only; requires explicit caveat.
 
7. Reviewer QA Checks

Before approval, reviewer confirms:
Correct metric-unit mapping
Correct threshold-band assignment
Claim language matches confidence level
Citation completeness for all non-obvious findings
Disclaimer included where required
 
8. Output Quality Standard

A mapping output is considered acceptable only when:
reasoning is reproducible,
interpretation is understandable by a layperson,
recommendations are actionable, and
evidence links are traceable.
 
9. Open Items

Confirm final source hierarchy for conflict resolution.
Define fallback language when evidence confidence is low.
Confirm mandatory disclaimer block for customer reports.
 
 
 
21. Dual Workflow System Specification Addendum (Locked 2026-04-08)

 
21.1 Workflow A Service Boundary (Reference -> Rulebook)

Services:
- Source Intake Service
- Citation Extraction Service
- Review and Approval Console
- Rulebook Publish Service
 
Data contracts:
- source_id, source_version, citation_unit_id, rule_version, approval_status
 
Gates:
- No rule publish without reviewer and approver sign-off.
- Superseded rules remain queryable but non-default.
 
21.2 Workflow B Service Boundary (Scan -> Report)

Services:
- Upload and Validation Service
- Readings Normalisation Service
- Rule Evaluation Service (read-only rulebook)
- Report Generation Service
- Reviewer QA and Release Service
 
Data contracts:
- assessment_id, input_file_id, rule_version_used, citation_unit_ids, reviewer_status
 
Gates:
- Report approval blocked if required citations are missing.
- Report approval blocked if rule_version is undefined, disclaimer_approval_status is not approved, or approver is not Jay Choy.
 
21.3 Runtime Integrity Constraints

- Rule Evaluation Service must be read-only against Rulebook runtime store.
- Any threshold mutation request in Workflow B must be rejected.
- Every report output must include rule_version_used and citation trace.
 
 
22. Operational Constraints Addendum (2026-04-08)
- Workflow B report SLA timer starts at analyst upload timestamp.
- Approval role check is mandatory: only Jay Choy can move report state from in_review to approved.
- Certification outcome service is strictly rule-based; override endpoint is disabled.
- Context applicability check is mandatory for mixed premises (industrial, office, residential).
- If no valid applicable rule set exists for a context/metric, system must return "Insufficient Evidence" state and block certification decision.
 
 
23. OfficialStack Reference Handling Addendum (2026-04-11)
- Add source metadata fields to standards registry and runtime payload:
 source_version_label, source_effective_date, source_currency_status, source_completeness_status, source_last_verified_at.
- Allowed source_currency_status values:
 Current Verified, Partial Extract, Version Unverified, Superseded.
- Evaluation engine constraints:
 1) Rules from Current Verified sources -> eligible for certification path.
 2) Rules from Partial Extract or Version Unverified -> advisory only with explicit warning labels; block certification decision.
 3) Rules from Superseded sources -> blocked unless explicitly retained by governance exception.
- QA gate update:
 report approval must fail if any certification-impact finding cites a non-Current-Verified source.
- Sync requirement:
 OfficialStack source registry to be reviewed quarterly; critical standards updated within 7 business days after detected revision.
 
No manual threshold override path shall exist in Workflow B. Any threshold change must go through Workflow A governance and approval before runtime use.
 
 
24. Product Excellence Specification
 
24.1 Feature Modules to Implement
A) Dashboard Modules
- Executive Overview Module
- Operations Alert Queue Module
- Zone/Floor Drilldown Module
- Cross-Site Comparison Module
- Intervention Effect Tracking Module
 
B) Reporting Modules
- Executive Brief Composer
- Parameter Insight Blocks (standardized schema)
- Action Register Generator (owner/due date/verification metric)
- Confidence + Causality Statement Generator
 
24.2 Data Contracts (New Required Fields)
- dashboard_role_view (executive/ops/analyst)
- alert_priority (P1/P2/P3)
- action_owner
- action_due_date
- intervention_id
- baseline_window
- post_window
- causality_confidence
- data_quality_score
- source_currency_status
 
24.3 Rule-Evaluation Integration
- All dashboard and report outputs must consume Rulebook runtime API only
- Any module request without rule_version + citation_id must fail validation
- Benchmark lane must be explicit per metric (SS554 baseline, BCA/WELL overlay where applicable)
 
24.4 UX and Output Requirements
- Executive view loads top risks and top actions first
- Ops view prioritizes unresolved alerts and overdue actions
- Analyst view exposes raw/normalized data with rule hit traces
- Report front page must summarize status, score lane, risks, and action deadlines
 
24.5 QA Gate Enhancements
A report fails release if any of the following is true:
- missing action owner or due date for P1/P2 items
- missing causality confidence for intervention-impact claims
- missing data-quality statement
- missing rule_version/citation_id for certification-impact findings
 
24.6 Rollout Plan (Low-Risk Sequence)
Phase 1 (Reversible): reporting structure upgrades + metadata enforcement
Phase 2 (Reversible): alert queue + action register + executive dashboard
Phase 3 (Controlled): cross-site analytics + intervention confidence layer
 
24.7 Validation Checklist
- NPE sample run passes all new report gates
- CAG sample run passes all new report gates (including data-gap handling)
- Executive review usability test: decision clarity within 5 minutes
- Audit trace test: each major finding reproducible from source + rule
 