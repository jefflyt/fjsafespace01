---
name: "00-init-project"
description: Initialize project structure and establish file path conventions.
---

# /00-init-project

Initialize a repository for use with the specs-driven development pipeline. Creates the directory structure and `.project-meta.json` so all downstream commands know exactly where to find files.

## Pipeline Context
- **Sequence**: Step 00 — First command to run in any repo using this pipeline
- **Next**: `/01-create-psd` (or `/03-plan-product` if PSD already exists)

## Instructions

You are initializing a repository for the specs-driven development pipeline.

Your job:
- Ask for the project name (or infer from repo name if obvious).
- Create the standard directory structure under `docs/`.
- Create `.project-meta.json` at the repo root with absolute file paths.
- If docs already exist at non-standard paths, point the meta file to them.

## Rules
- Ask at most 2 questions: project name, and whether existing docs should be migrated.
- Do NOT create PSD or TDD templates — those are created by their own commands.
- Do NOT overwrite existing `.project-meta.json` — show the user current values and ask before updating.

## Steps

### Step 01: Determine Project Name
If the repo name is descriptive (e.g., `fjsafespace01` → "FJ SafeSpace", `my-api` → "My API"), propose it. Otherwise ask the user.

### Step 02: Check for Existing Docs
Look for existing PSD/TDD/plan files in common locations:
- `docs/` (any `.md` files)
- `docs/psd/`, `docs/tdd/`, `docs/plans/`

If found, ask the user whether to:
- Keep them at current paths (meta file points to them)
- Migrate them to standard paths (`docs/PSD.md`, `docs/TDD.md`)

### Step 03: Create Directory Structure
Create directories if they don't exist:
- `docs/`
- `docs/plans/`
- `docs/decisions/`
- `docs/verification/`

Add `.gitkeep` to any empty directories.

### Step 04: Create `.project-meta.json`
Write to the repo root:

```json
{
  "project_name": "[Project Name]",
  "project_type": "",
  "psd_path": "docs/PSD.md",
  "tdd_path": "docs/TDD.md",
  "stack": {},
  "package_manager": "",
  "test_runner": "",
  "plans_dir": "docs/plans",
  "decisions_dir": "docs/decisions",
  "verification_dir": "docs/verification"
}
```

If existing docs are kept at non-standard paths, adjust `psd_path` and `tdd_path` accordingly. The `project_type` and `stack` fields are populated by downstream commands (`/01-create-psd`, `/02-create-tdd`, `/04-bootstrap-repo`). Leave them empty or minimal here.

### Step 05: Confirm
Show the user the created structure and meta file contents. Explain that all subsequent commands will read from this file.

## Output

Confirm with the user:

```markdown
## Project Initialized: [Project Name]

### Directory Structure
```
docs/
├── plans/
├── decisions/
└── verification/
```

### Configuration (`.project-meta.json`)
- Project: `[Project Name]`
- PSD: `docs/PSD.md`
- TDD: `docs/TDD.md`
- Plans: `docs/plans/`
- Decisions: `docs/decisions/`
- Verification: `docs/verification/`

Note: `project_type`, `stack`, and tooling fields will be populated by downstream commands as the pipeline progresses.

### Next Step
Run `/01-create-psd` to start writing your Product Specification Document.
```
