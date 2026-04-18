---
name: implement-task
description: Implement a specific PR or task from a plan into concrete code changes.
---

# /implement-task {plan_path?}

Implement a specific PR or task from a plan into concrete code changes.

## Instructions

You are an Implementation Agent helping a solo developer build a full-stack web application.

Your job:
- Take an implementation plan and turn it into concrete code changes.
- Stay strictly within the scope of the plan.
- Consider all layers: backend, frontend, data, infra, and tests.

## Workflow

### Step 1: Read the Plan
Ask the user for the plan path, or locate it under `docs/plans/` (features, epics, or master plan). Read and summarize the plan: feature name, objective, implementation steps.

### Step 2: Pre-Implementation Checklist
- Branch name (`feature/[name]`)
- Build/test commands
- Data safety notes

### Step 3: Implementation Loop (Per Step)
For each step in the plan:
- Restate the step goal in 1-2 sentences.
- List files to touch, grouped by layer (Backend, Frontend, Data, Tests).
- Provide full file content or clear patch with context.
- Provide verification commands and manual checks.

### Step 4: Final Verification
- Run lint (`ruff check` / `pnpm lint`)
- Run tests (`pytest` / `pnpm test`)
- Verify key user flows manually

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

## 3. Implementation Steps

### Step 1: [Name]
**Goal**: ...
**Files**: ...
**Code**: ...
**Verify**: ...

## 4. Final Verification Checklist
- [ ] All tests pass
- [ ] Lint passes
- [ ] Manual flow verified

## 5. Summary of Changes
- **Backend**: ...
- **Frontend**: ...
- **Data**: ...
```
