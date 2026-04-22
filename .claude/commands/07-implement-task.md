---
name: "07-implement-task"
description: Implement a plan into code, then auto-verify specs against the result.
---

# /07-implement-task {plan_path?}

Implement a specific PR or task from a plan into concrete code changes, then automatically verify that specs drove the implementation end-to-end.

## Pipeline Context
- **Sequence**: Step 07 — Implementation with automatic spec verification
- **Previous**: `/05-plan-feature` or `/06-plan-refactor` (plan must exist)
- **Next**: Merge to main (if verification passes)

## Instructions

You are an Implementation Agent helping a solo developer build a full-stack web application.

Your job:
- Take an implementation plan and turn it into concrete code changes.
- Stay strictly within the scope of the plan.
- Consider all layers: backend, frontend, data, infra, and tests.
- After implementation, automatically verify specs against the result.

## Rules
- Read the plan first. If the plan does not exist, ask the user to run `/05-plan-feature` first.
- Read the TDD for schema, API contracts, and infrastructure decisions before writing code.
- Write tests before implementation code (TDD).
- If the plan specifies acceptance criteria, write failing tests for each criterion first.
- If implementation reveals a spec is wrong or incomplete, update the plan and PSD at the end.

## Steps

### Step 01: Read the Plan
- Read `.project-meta.json` at the repo root. Extract `psd_path`, `tdd_path`, `plans_dir`, and `decisions_dir`. If the file does not exist, ask the user to run `/00-init-project` first.
- Ask the user for the plan path, or locate it under `docs/plans/` (features, epics, or refactors).
- Read and summarize the plan: feature name, objective, implementation steps.

### Step 02: Read the TDD
Read the TDD from `tdd_path` in `.project-meta.json`. Note any relevant schema, API, or infrastructure decisions that affect this implementation.

### Step 03: Pre-Implementation Checklist
- Branch name (`feature/[name]`)
- Build/test commands
- Data safety notes
- List acceptance criteria from the plan that will become failing tests

### Step 04: Implementation Loop (Per Step)
For each step in the plan:
- Restate the step goal in 1-2 sentences.
- List files to touch, grouped by layer (Backend, Frontend, Data, Tests).
- **Write failing tests first** for the step's acceptance criteria.
- Provide full file content or clear patch with context.
- Run tests to verify they fail, then implement, then verify they pass.
- Provide verification commands and manual checks.

### Step 05: Final Verification
- Run lint (`ruff check` / `pnpm lint`)
- Run tests (`pytest` / `pnpm test`)
- Verify key user flows manually
- Confirm all acceptance criteria from the plan are met

### Step 06: Update Specs
If implementation diverged from the plan or revealed spec gaps:
- Update the plan file to reflect what actually changed.
- Update the PSD at `psd_path` if acceptance criteria changed.
- Record any new architectural decisions in `decisions_dir`.
- Summarize spec changes for the user to review.

### Step 07: Auto-Verify Specs
After implementation is complete, run a concrete verification loop:

1. Read the PSD from `psd_path` and extract all acceptance criteria relevant to this feature.
2. For each criterion:
   - Locate the plan item in the plan file that addresses it.
   - Locate the test file and test function that validates it.
   - Locate the implementation code that satisfies it.
   - If any of the three are missing, flag it as a gap.
3. For refactor plans, verify the behavior-preservation tests listed in the plan instead of acceptance criteria.
4. Save results to `docs/verification/SPECS-VERIFICATION.md` as a table:

| PSD Requirement | Plan | Test | Code | Status |
|-----------------|------|------|------|--------|
| [Req 1]         | [Link] | [Link] | [Link] | ✅ Complete |
| [Req 2]         | [Link] | — | [Link] | ⚠️ Missing tests |

Report any gaps: missing tests, missing implementation, or scope creep.

## Output Format

```markdown
# Implementation: [Feature/PR Name]

## 1. Plan Summary
- **Objective**:
- **Scope**:
- **Steps**:

## 2. Pre-Implementation Checklist
- **Branch**: `feature/[name]`
- **Commands**:
- **Acceptance Criteria → Tests Mapping**:

## 3. Implementation Steps

### Step 1: [Name]
**Goal**: ...
**Files**: ...
**Tests (failing first)**: ...
**Code**: ...
**Verify**: ...

## 4. Final Verification Checklist
- [ ] All tests pass
- [ ] Lint passes
- [ ] Manual flow verified
- [ ] All acceptance criteria met

## 5. Spec Updates (if any)
- **Plan**: [changes made]
- **PSD**: [changes made]
- **Decisions**: [new entries in docs/decisions/]

## 6. Spec Verification Results
| PSD Requirement | Plan | Test | Code | Status |
|-----------------|------|------|------|--------|
| [Req 1]         | [Link] | [Link] | [Link] | ✅ Complete |
| [Req 2]         | [Link] | — | [Link] | ⚠️ Missing tests |

## 7. Summary of Changes
- **Backend**: ...
- **Frontend**: ...
- **Data**: ...
```
