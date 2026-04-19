# Supabase Setup Guide — FJDashboard

**Purpose**: Configure Supabase for the FJDashboard project — both Postgres (database + schema) and Storage (raw CSV uploads).

**Time**: ~15 minutes

---

## Current Status

The Supabase project `fjsafespace` (`jertvmbhgehajcrfifwl`) is **already set up** with:

- **Postgres**: All 11 tables created via migration `001_fjsafespace_full_schema`
- **Storage**: `iaq-scans` bucket for raw CSV uploads
- **Region**: `ap-southeast-1` (Singapore)

This guide is for reference or rebuilding the setup.

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (GitHub account recommended).
2. Click **"New Project"**.
3. Fill in:
   - **Project name**: `fjsafespace` (or any name you prefer)
   - **Database Password**: Generate a strong password — **save it somewhere safe**.
   - **Region**: Select the closest region to you (e.g., Singapore / Southeast Asia).
4. Click **"Create new project"**. Wait ~2 minutes for provisioning.

---

## Step 2: Get Your Project Credentials

Once the project is ready:

1. In the left sidebar, go to **Project Settings** (gear icon) → **API**.
2. Under **Project URL**, copy the URL. It looks like:

   ```text
   https://xxxxxxxxxxxxxxxx.supabase.co
   ```

3. Under **Project API keys**, find the **`service_role`** key (not the `anon` key). Copy it. It looks like:

   ```text
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. Under **Database**, copy the connection string for use as `DATABASE_URL`.

> **Warning**: The `service_role` key bypasses Row Level Security. Never expose it in frontend code. It belongs only in `.env` at the project root.

---

## Step 3: Apply Database Schema

The project uses 11 tables across two workflows. Full schema reference: [`docs/SCHEMA_REFERENCE.md`](../../docs/SCHEMA_REFERENCE.md).

### Option A: Via Supabase MCP (recommended)

If you have the Supabase MCP server configured, run the migration through the MCP `apply_migration` tool. The migration file `001_fjsafespace_full_schema` is already applied to the production project.

### Option B: Via SQL Editor

1. In the Supabase dashboard, go to **SQL Editor**.
2. Paste the full migration SQL from `backend/migrations/versions/001_fjsafespace_full_schema.sql` (if exported) or from the migration tool output.
3. Click **Run**.

### Option C: Via Alembic (local development)

For local Docker PostgreSQL:

```bash
cd backend
source .venv/bin/activate
export DATABASE_URL="postgresql+psycopg2://dev:dev@localhost:5432/fjsafespace"
alembic upgrade head
```

### Tables Created

| Workflow | Table | Purpose |
| --- | --- | --- |
| **A** | `reference_source` | Standards registry (WHO, SS554, etc.) |
| **A** | `citation_unit` | Individual clauses with verbatim excerpts |
| **A** | `rulebook_entry` | Runtime thresholds linked to citations |
| **Supporting** | `tenant` | Phase 3 multi-tenant profiles |
| **Supporting** | `notification` | In-app alerts for ops team |
| **B** | `site` | IAQ monitoring locations |
| **B** | `upload` | CSV uploads with parse status |
| **B** | `reading` | Raw sensor data rows |
| **B** | `finding` | Rule evaluation output |
| **B** | `report` | Final reports with QA checklist + snapshot |
| **Legacy** | `rulebook` | Flat JSON structure — superseded, kept as backup |

---

## Step 4: Create the Storage Bucket

1. In the left sidebar, go to **Storage** (database icon).
2. Click **"New Bucket"**.
3. Fill in:
   - **Bucket name**: `iaq-scans` (must match `SUPABASE_STORAGE_BUCKET` in `.env`)
   - **Bucket type**: **Public** (so public URLs work for download)
4. Click **"Create bucket"**.

### Set Up Bucket Policies

The dashboard uses the `service_role` key, which bypasses RLS. But for safety, add a policy:

1. Go to **Storage** → Select the `iaq-scans` bucket → **Policies** tab.
2. Click **"New Policy"** → **"For full customization"** → **Continue**.
3. Fill in:
   - **Policy name**: `Enable all operations for service role`
   - **Allowed operation**: All (SELECT, INSERT, UPDATE, DELETE)
   - **Target roles**: `service_role`
4. Click **"Review"** → **"Save policy"**.

---

## Step 5: Update `.env` (project root)

Open `.env` at the project root and update these variables:

```ini
# Supabase Postgres connection string
DATABASE_URL=postgresql+psycopg2://postgres:<password>@db.jertvmbhgehajcrfifwl.supabase.co:5432/postgres

# Full-access DB role (for Workflow A admin operations)
ADMIN_DATABASE_URL=postgresql+psycopg2://postgres:<password>@db.jertvmbhgehajcrfifwl.supabase.co:5432/postgres

# Supabase project URL
SUPABASE_URL=https://jertvmbhgehajcrfifwl.supabase.co

# Service role key (from Step 2)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Storage bucket name (must match the bucket you created)
SUPABASE_STORAGE_BUCKET=iaq-scans
```

---

## Step 6: Seed Rulebook Data

Populate the Workflow A tables with WHO AQG 2021 and SS 554:2018 standards:

```bash
cd backend
source .venv/bin/activate
python scripts/seed_rulebook.py
```

Verify with:

```bash
curl http://localhost:8000/api/rulebook/rules | python -m json.tool
```

---

## Step 7: Verify the Connection

### Test the Python client

```bash
cd backend
source .venv/bin/activate
python -c "
from supabase import create_client
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')

client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
buckets = client.storage.list_buckets()
print('Connected! Buckets:', [b.name for b in buckets])
"
```

**Expected output:**

```text
Connected! Buckets: ['iaq-scans']
```

### Test the full flow

```bash
# Terminal 1
cd backend && fastapi dev app/main.py

# Terminal 2
cd frontend && pnpm dev
```

1. Open `http://localhost:3000/ops`
2. Upload a sample CSV from `assets/sample_uploads/npe_sample.csv`
3. Verify findings appear, then generate a report

---

## Summary of What You Need

| Item | Value |
| ------ | ------ |
| Project Ref | `jertvmbhgehajcrfifwl` |
| Project URL | `https://jertvmbhgehajcrfifwl.supabase.co` |
| Database Host | `db.jertvmbhgehajcrfifwl.supabase.co` |
| Region | `ap-southeast-1` (Singapore) |
| Service Role Key | `eyJhbGci...` (long JWT) |
| Storage Bucket | `iaq-scans` (Public) |
| Tables | 11 (see SCHEMA_REFERENCE.md) |

## Common Issues

| Issue | Fix |
| ------ | ------ |
| `401 Unauthorized` on upload | Double-check `SUPABASE_SERVICE_ROLE_KEY` — make sure it's the `service_role` key, not `anon` |
| `Bucket not found` | Verify `SUPABASE_STORAGE_BUCKET` matches exactly (`iaq-scans`, case-sensitive) |
| CORS error | Supabase Storage handles CORS automatically — this is usually a Next.js proxy issue |
| Upload succeeds but download fails | Make sure bucket is set to **Public** type in Storage settings |
| `NoSuchModuleError` on alembic | Use `postgresql+psycopg2://` prefix in `DATABASE_URL`, not `postgresql://` |
| Migration not applied | Run `alembic upgrade head` with the correct `DATABASE_URL` |
