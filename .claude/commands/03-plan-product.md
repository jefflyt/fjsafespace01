---
name: "03-plan-product"
description: Create a high-level architecture, phases, and initial PR breakdown from the PSD.
---

# /03-plan-product

Create a high-level architecture, phases, and initial PR breakdown from the Product Specification Document (PSD) and Technical Design Document (TDD).

## Pipeline Context
- **Sequence**: Step 03 — Macro planning for an existing repo
- **Previous**: `/01-create-psd` (PSD must exist) and optionally `/02-create-tdd`
- **Next**: `/05-plan-feature` (for each PR) or `/04-bootstrap-repo` (if repo is empty)

## Instructions

You are a Project Planning Agent helping a solo founder design and plan a full-stack web application.

Your job:
- Read the PSD and TDD if they exist.
- Propose a realistic architecture and technology stack.
- Break the work into phases and an initial PR breakdown (3-7 PRs).
- Do NOT write any implementation code.

Assume: solo founder, full-stack web app, speed and maintainability matter.

## Rules
- No implementation code, pseudocode, or fenced code blocks.
- The PSD is the primary source of truth for product requirements.
- If the TDD exists, use it as the authoritative source for schema, API contracts, and infrastructure decisions.
- Ask at most 3 clarifying questions ONLY if they block architecture choices.
- Default to boring, widely-supported choices.
- If the repo is empty (greenfield), include PR0: Project Bootstrap.

## Steps

### Step 01: Read Project Configuration and Specs

Read `.project-meta.json` at the repo root. Extract `psd_path`, `tdd_path`, and `plans_dir`. If the file does not exist, ask the user to run `/00-init-project` first.

Read the PSD from `psd_path` and TDD from `tdd_path` (if it exists). Summarize key product requirements and technical decisions.

### Step 02: Propose Architecture
Design or validate the architecture and technology stack. Justify each choice. If the TDD exists, validate against its decisions rather than proposing new ones.

### Step 03: Define Phases and PR Breakdown
Break the work into phases. Provide an initial PR breakdown for Phase 1.

### Step 04: Save the Master Plan
Write the plan and confirm the path with the user.

## Output

Save to `docs/plans/MASTER_PLAN.md`:

```markdown
# MASTER PLAN: [Product Name]

## 1. Product Summary
- Problem Statement
- Target Users
- Value Proposition
- Core Features

## 2. Goals, Success Criteria, and Constraints

## 3. Architecture & Technology Stack
### 3.1 Frontend
### 3.2 Backend
### 3.3 Data
### 3.4 Auth & Security
### 3.5 Infrastructure & Deployment

## 4. Project Phases

## 5. Initial PR Breakdown (Phase 1)
### PR0: Project Bootstrap (if greenfield)
### PR1: [Name]
### PR2: [Name]

## 6. Risks, Trade-offs, and Open Questions
```
