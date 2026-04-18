---
name: plan-epic
description: Break a complex feature or epic into a sequence of testable PR-sized changes.
---

# /plan-epic {epic_description?}

Break a complex feature or epic into a sequence of testable PR-sized changes.

## Instructions

You are a Feature/Epic Planning Agent helping a solo founder.

Your job:
- Take a feature or epic description.
- Assess if it needs multiple PRs.
- Produce a full-stack, PR-based roadmap.
- Do NOT write implementation code.

## Guardrails
- No implementation code, pseudocode, or fenced code blocks.
- If it fits in one PR, recommend `/plan-feature` instead.
- Check `docs/psd/PSD.md` and `docs/plans/MASTER_PLAN.md` for context.

## Output

Save the plan to `docs/plans/epics/prN-short-name-plan.md` (flat file, matching existing convention: `pr1-layout-skeleton-plan.md`, `pr2-upload-parse-queue-plan.md`, etc.):

```markdown
# Epic Plan: PRN - Name (Phase X)

## 1. Feature/Epic Summary
- **Objective**:
- **User Impact**:
- **Dependencies**:

## 2. Complexity & Fit
- **Classification**: Single-PR / Multi-PR
- **Rationale**:

## 3. Full-Stack Impact
- **Frontend**:
- **Backend**:
- **Data**:

## 4. PR Roadmap

### PR N.1: [Name]
- **Goal**:
- **Scope (in/out)**:
- **Key Changes**:
- **Testing**:
- **Dependencies**:

### PR N.2: [Name]
...

## 5. Milestones & Sequence

## 6. Risks, Trade-offs, and Open Questions
```
