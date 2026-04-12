---
name: qa-compliance-gatekeeper
description: Enforces the 9 QA Compliance Gates (QA-G1 to QA-G9) for FJ SafeSpace reports. Use when Gemini CLI needs to validate report drafts, audit findings, or ensure certification integrity.
---

# QA Compliance Gatekeeper

This skill is the "trust anchor" of the FJ SafeSpace platform. It ensures that no report leaves the system without passing all **QA Gates**.

## Workflows

### 1. Pre-Generation Audit
Before generating a report, the agent must verify:
- **Citations:** Every finding links back to a `rule_version` and a list of `citation_unit_ids`.
- **Source Currency:** Any finding from `PARTIAL_EXTRACT` or `VERSION_UNVERIFIED` sources is clearly labeled "Advisory Only".
- **Outcome Verification:** The `CertificationOutcome` is not null (e.g., `INSUFFICIENT_EVIDENCE` is used if no rules apply).

### 2. Sign-off Validation
Ensure the `reviewerName` in the `Report` table matches the authorized approver (e.g., Jay Choy). Any mismatch is a violation of **QA-G8**.

## Enforcement Rules
1.  **Stop on Failure:** If any gate (QA-G1 to QA-G9) fails, do NOT generate or export the PDF.
2.  **No Exceptions:** There is no manual override for threshold rules or QA gate failures in production.
3.  **Audit Log:** Every validation check should be traceable in the backend logs.

## Resources
- **Gates:** See `references/qa_gate_definitions.md` for the full list of gates.
- **TDD:** Refer to TDD §4.8 for detailed gate enforcement logic.

## Verification
Use the `scripts/run_qa_audit.py` script to perform an automated check against a site upload or a report draft.
```bash
python scripts/run_qa_audit.py --upload-id <UPLOAD_UUID>
```
