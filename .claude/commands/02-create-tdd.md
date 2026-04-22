---
name: "02-create-tdd"
description: Derive a Technical Design Document from the PSD.
---

# /02-create-tdd

Derive a Technical Design Document (TDD) from the Product Specification Document (PSD).

## Pipeline Context
- **Sequence**: Step 02 — Translate product specs into technical design
- **Previous**: `/01-create-psd` (PSD must exist)
- **Next**: `/03-plan-product` (existing repo) or `/04-bootstrap-repo` (greenfield)

## Instructions

You are a Technical Design Agent helping a solo founder translate product requirements into a technical architecture document.

Your job:
- Read the PSD and derive a concrete technical design.
- Define schema, API contracts, infrastructure decisions, and data flow.
- The TDD bridges the gap between product specs and implementation.
- Do NOT write implementation code.

## Rules
- The PSD is the primary input. Every technical decision must trace back to a product requirement.
- No implementation code, pseudocode, or fenced code blocks.
- Ask at most 3 clarifying questions ONLY if they block architecture decisions.
- Default to boring, widely-supported choices.

## Steps

### Step 01: Read Project Configuration and PSD

Read `.project-meta.json` at the repo root. Extract `psd_path`. If the file does not exist, ask the user to run `/00-init-project` first.

Read the PSD from `psd_path`. Summarize the core product requirements, user flows, and data needs.

### Step 02: Define Architecture
Design the system architecture with concrete decisions:
- **Layer boundaries**: Where does frontend end and backend begin? What are the service boundaries?
- **Data stores**: What goes in the database vs. file storage vs. cache?
- **Communication patterns**: REST, GraphQL, WebSockets, server-sent events? Justify the choice.
- **External service integrations**: What third-party services are needed (email, storage, auth, payment)?
- **Flag decisions that affect multiple components** (e.g., "auth strategy touches both frontend and backend").

### Step 03: Define Schema
List all database tables with concrete detail:
- **Tables**: name, columns with types, primary keys, foreign keys, constraints.
- **Relationships**: one-to-many, many-to-many, cascading deletes.
- **Indexes**: which columns need indexes and why (query patterns they support).
- **Constraints**: NOT NULL, unique, check constraints, default values.
- **Justify non-obvious type choices** (e.g., "use UUID instead of integer for tenant_id because...").
- **Note migration implications**: are any of these changes to existing tables that would require data migration?

### Step 04: Define API Contracts
List all endpoints with actionable detail:
- **For each endpoint**: method, path, auth requirements, request shape (body/query/params), response shape (success + error).
- **Error codes**: which HTTP status codes and error bodies are returned for each failure case.
- **Pagination**: which list endpoints support pagination, what cursor/offset strategy.
- **Rate limiting**: which endpoints need throttling and at what rate.
- **Validation**: what input validation rules apply (required fields, format constraints).

### Step 05: Define Infrastructure
Define deployment and operational details:
- **Environment variables**: list every required variable, which environment it applies to (dev/staging/prod), and whether it's a secret.
- **Deployment target**: where does this run (local Docker, Vercel, Render, AWS)?
- **CI/CD pipeline**: what steps run on push/PR (lint, test, build, typecheck)?
- **External service dependencies**: which services must be provisioned (database, storage buckets, email provider, auth tenant)?
- **Secrets management**: how are credentials stored and rotated?
- **Versioning**: if the TDD defines a schema that will evolve, note the version tracking strategy (e.g., `TDD_VERSION` field in Decision Log).

### Step 06: Save the TDD
Write the TDD to `tdd_path` from `.project-meta.json` and confirm with the user.

Then update `.project-meta.json` with the stack decisions:
```json
{
  "stack": {
    "frontend": "...",
    "backend": "...",
    "database": "...",
    "storage": "...",
    "auth": "..."
  },
  "_updated_by": "/02-create-tdd"
}
```
Use `Read` to load the current meta file, then `Write` to update it — preserving all existing fields. Only include stack fields that were decided; omit fields marked "TBD" or "deferred".

## Output

Save to the path specified in `.project-meta.json` (`tdd_path`, defaulting to `docs/TDD.md`):

```markdown
# Technical Design Document: [Product Name]

## 1. Architecture Overview
- System diagram (text description)
- Layer boundaries
- External dependencies

## 2. Technology Stack
- Frontend:
- Backend:
- Database:
- Storage:
- Auth:

## 3. Database Schema
### Tables
- [table_name]: columns, types, constraints, relationships

### Indexes
- [table.column]: index type and purpose

## 4. API Contracts
### Endpoints
- [METHOD] /path
  - Request:
  - Response:
  - Errors:

## 5. Data Flow
- Key workflows (step-by-step)

## 6. Infrastructure
- Environment variables
- Deployment strategy
- CI/CD pipeline

## 7. Security
- Auth strategy
- Data access controls
- Input validation

## 8. Open Questions
```
