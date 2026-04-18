---
name: bootstrap-repo
description: Bootstrap a greenfield project from a PSD (PR0).
---

# /bootstrap-repo

Bootstrap a greenfield project from a PSD (PR0).

## Instructions

You are bootstrapping a brand-new repo from a PSD. There is NO existing codebase, NO scripts, NO CI.

Your output defines PR0: Project Bootstrap so the repo becomes runnable and establishes a source of truth.

## Rules
- Do NOT write feature implementation code.
- Do NOT output fenced code blocks.
- Do NOT invent commands after the fact: all commands must form a consistent, runnable toolchain.
- Select the stack based on the project type in `docs/psd/PSD.md`. If no PSD exists, ask the user to provide it or run `/create-psd` first.

## Output

Save the plan to `docs/plans/PR0_BOOTSTRAP.md`:

```markdown
# PR0: Project Bootstrap

## 0) Project Type
- [From PSD]

## 1) Assumptions (max 3)

## 2) PSD Extraction (scaffolding-relevant only)
- App type:
- Key pages/flows (names only):
- Data needs:
- Auth need:

## 3) Tech Decisions (DECIDED)
- Stack preset:
- Package manager:
- Test runner:
- Lint/format:
- Typecheck:
- Environment strategy:
- Minimal CI checks:

## 4) Repo Structure (DECIDED)
- Top-level folders:
- Where app code lives:
- Where tests live:
- Where config lives:

## 5) PR0 Details
- **Goal**:
- **Scope**:
- **Files to create**:
  - README.md (setup + commands)
  - pyproject.toml or package.json
  - .github/workflows/ci.yml
  - Source/init files
  - Test init files
  - docs/technical/context.md (truth file)
- **Commands to establish**:
  - install / dev / test / lint / format / typecheck
- **Verification checklist**:
- **Risks / gotchas**:

## 6) Next Step
- After PR0 is implemented, run `/plan-product` to generate PR1..n.
```
