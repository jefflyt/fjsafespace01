# FJ SafeSpace QA Gate Definitions (QA-G1 to QA-G9)

All 9 QA gates must be satisfied before a report can be finalized and exported.

| Gate | Name | Requirement | Fail Condition |
|---|---|---|---|
| **QA-G1** | Parse Success | Upload status must be `COMPLETE`. | Status is `FAILED` or `PENDING`. |
| **QA-G2** | Metric Coverage | All core metrics (`co2_ppm`, `pm25_ugm3`, etc.) must be present. | Any core metric is missing from upload. |
| **QA-G3** | Zero Values | Check for invalid zero values in IAQ sensors. | Value is 0.0 for a metric where 0 is physically impossible. |
| **QA-G4** | Data Quality Statement | Analyst must confirm the `dataQualityStatement`. | Statement is absent or "Not Confirmed". |
| **QA-G5** | Citation Completeness | Every certification-impact finding MUST have a `rule_version` + `citation_unit_ids`. | Any finding lacks these fields. |
| **QA-G6** | Source Currency Check | Non-`CURRENT_VERIFIED` sources must have "Advisory Only" labels. | Advisory label missing for non-current source. |
| **QA-G7** | Determination Logic | `CertificationOutcome` must not be null. | No applicable rule set exists (outcome should be `INSUFFICIENT_EVIDENCE`). |
| **QA-G8** | Reviewer Authority | Reviewer name must match the configured `APPROVER_EMAIL`. | Approver name mismatch (must be Jay Choy). |
| **QA-G9** | Tenant Isolation | (Phase 3) `tenant_id` must match the site's assigned tenant. | Tenant mismatch detected in JWT or DB query. |

## Enforcement Points
1.  **Backend:** `POST /api/reports/generate` (TDD §4.8).
2.  **Frontend:** `QAChecklist` component in the analyst view.
