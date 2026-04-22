---
name: "04-bootstrap-repo"
description: Bootstrap a greenfield project from a PSD and TDD (PR0).
---

# /04-bootstrap-repo

Bootstrap a brand-new repo from a PSD and TDD (PR0).

## Pipeline Context
- **Sequence**: Step 04 — For greenfield projects only
- **Previous**: `/01-create-psd` (PSD must exist) and `/02-create-tdd` (TDD recommended)
- **Next**: `/03-plan-product` (to generate PR1..n), then `/05-plan-feature` (per PR)

## Instructions

You are bootstrapping a brand-new repo from a PSD and TDD. There is NO existing codebase, NO scripts, NO CI.

Your output defines PR0: Project Bootstrap so the repo becomes runnable and establishes a source of truth.

## Rules
- Do NOT write feature implementation code.
- Do NOT output fenced code blocks.
- Do NOT invent commands after the fact: all commands must form a consistent, runnable toolchain.
- Select the stack from the TDD if it exists. If no TDD, derive it from the PSD. If no PSD exists, ask the user to run `/01-create-psd` first.

## Steps

### Step 01: Read Project Configuration and Specs

Read `.project-meta.json` at the repo root. Extract `psd_path`, `tdd_path`, `plans_dir`, and `decisions_dir`. If the file does not exist, ask the user to run `/00-init-project` first.

Read the PSD from `psd_path` for product context. Read the TDD from `tdd_path` if it exists for technical decisions (stack, schema, API contracts).

### Step 02: Define the Stack
If the TDD exists, use its technology stack. If not, select based on the PSD.

### Step 03: Define Repo Structure
Plan the folder layout and where code, tests, and config live. Ensure the structure aligns with the TDD architecture.

Also define the git workflow:
- **Repository initialization**: specify `git init`, initial `.gitignore`, and first commit structure.
- **Branch strategy**: `main` (production), `develop` (integration), feature branches (`feature/[name]`).
- **Initial commit**: what gets committed in PR0 (source init files, test init files, config, docs).
- **CI pipeline**: what `.github/workflows/ci.yml` should contain at minimum.

### Step 04: Save the Bootstrap Plan
Write the plan and confirm with the user.

Then update `.project-meta.json` with tooling decisions established during bootstrap:
```json
{
  "package_manager": "pip / pnpm / npm / etc.",
  "test_runner": "pytest / vitest / etc.",
  "lint_format": "ruff / prettier / etc.",
  "ci_commands": ["install", "lint", "test", "build"],
  "_updated_by": "/04-bootstrap-repo"
}
```
Use `Read` to load the current meta file, then `Write` to update it — preserving all existing fields.

## Output

Save to `docs/plans/PR0_BOOTSTRAP.md`:

```markdown
# PR0: Project Bootstrap

## 0) Project Type
- [From PSD and TDD]

## 1) Assumptions (max 3)

## 2) PSD + TDD Extraction (scaffolding-relevant only)
- App type:
- Key pages/flows (names only):
- Data needs:
- Auth need:
- Stack decisions:

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
- Where docs live (PSD, TDD, plans):

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
- After PR0 is implemented, run `/03-plan-product` to generate PR1..n.
```
