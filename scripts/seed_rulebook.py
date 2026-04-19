#!/usr/bin/env python3
"""
scripts/seed_rulebook.py

Single-script pipeline: PDF → extract → curated JSON → Supabase

Steps:
  1. Extracts text from PDFs in assets/standards/sources/ → assets/standards/extracted/
  2. Reads curated JSONs from assets/standards/curated/ (source of truth)
  3. Generates consolidated rulebook.json → assets/standards/
  4. Upserts to Supabase `rulebook` table (no duplicates)

Usage:
    cd backend
    source .venv/bin/activate
    python ../scripts/seed_rulebook.py

Idempotent: Re-running updates existing records, never duplicates.
"""

import sys
import os
import json
import subprocess
import requests
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
STANDARDS_DIR = PROJECT_ROOT / "assets" / "standards"
SOURCES_DIR = STANDARDS_DIR / "sources"
EXTRACTED_DIR = STANDARDS_DIR / "extracted"
CURATED_DIR = STANDARDS_DIR / "curated"
ENV_PATH = PROJECT_ROOT / ".env"

SUPABASE_TABLE = "rulebook"


# ── Config ────────────────────────────────────────────────────────────────────

def load_env() -> dict:
    env = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def supabase_headers(env: dict) -> dict:
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def supabase_url(env: dict) -> str:
    return env.get("SUPABASE_URL", "")


# ── Step 1: Extract PDFs → text ───────────────────────────────────────────────

def extract_pdfs():
    """Extract text from all PDFs in sources/ → extracted/."""
    pdf_files = sorted(SOURCES_DIR.glob("*.pdf"))
    if not pdf_files:
        print("  No PDFs found in sources/. Skipping extraction.")
        return []

    print(f"\n  Extracting {len(pdf_files)} PDF(s)...")
    results = []
    for pdf_path in pdf_files:
        output_path = EXTRACTED_DIR / f"{pdf_path.stem}.txt"

        # Skip if already extracted and PDF hasn't changed
        if output_path.exists() and output_path.stat().st_mtime >= pdf_path.stat().st_mtime:
            results.append(output_path)
            print(f"    ✓ {pdf_path.name} (cached)")
            continue

        result = subprocess.run(
            ["pdftotext", str(pdf_path), "-"],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"    ✗ {pdf_path.name}: pdftotext failed")
            continue

        output_path.write_text(result.stdout, encoding="utf-8")
        lines = result.stdout.count("\n")
        results.append(output_path)
        print(f"    ✓ {pdf_path.name} → {output_path.name} ({lines} lines)")

    return results


# ── Step 2: Read curated JSONs ────────────────────────────────────────────────

def read_curated_jsons() -> list[dict]:
    """Read curated JSON files from curated/ directory."""
    json_files = sorted(CURATED_DIR.glob("*.json"))
    if not json_files:
        print("  No curated JSONs found in curated/.")
        return []

    print(f"\n  Reading {len(json_files)} curated JSON(s)...")
    standards = []
    for json_file in json_files:
        with open(json_file) as f:
            data = json.load(f)

        source = {k: v for k, v in data.get("source", {}).items() if not k.startswith("_")}
        rules = []
        for block in data.get("rules", []):
            citation = {k: v for k, v in block.get("citation", {}).items() if not k.startswith("_")}
            rule = {k: v for k, v in block.get("rule", {}).items() if not k.startswith("_")}
            rules.append({"citation": citation, "rule": rule})

        standards.append({
            "standard_name": source.get("title", json_file.stem),
            "publisher": source.get("publisher", "Unknown"),
            "version": source.get("version_label", "1.0"),
            "source_type": source.get("source_type", "standard"),
            "jurisdiction": source.get("jurisdiction", "unknown"),
            "effective_date": source.get("effective_date"),
            "source_currency_status": source.get("source_currency_status", "CURRENT_VERIFIED"),
            "rules": rules,
            "metadata": {
                "url": source.get("url"),
                "published_date": source.get("published_date"),
                "json_file": json_file.name,
            }
        })
        print(f"    ✓ {source.get('title', json_file.stem)} ({len(rules)} rules)")

    return standards


# ── Step 3: Generate consolidated rulebook.json ───────────────────────────────

def generate_rulebook_json(standards: list[dict]) -> Path:
    """Write consolidated rulebook.json to assets/standards/."""
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "standards": standards,
        "summary": {
            "total_standards": len(standards),
            "total_rules": sum(len(s["rules"]) for s in standards),
        }
    }

    output_path = STANDARDS_DIR / "rulebook.json"
    output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n  Consolidated rulebook.json generated ({output['summary']['total_rules']} rules)")
    return output_path


# ── Step 4: Upsert to Supabase ────────────────────────────────────────────────

def upsert_to_supabase(standards: list[dict], env: dict):
    """Upsert standards to Supabase rulebook table."""
    base_url = supabase_url(env)
    headers = supabase_headers(env)
    rest_url = f"{base_url}/rest/v1/{SUPABASE_TABLE}"

    created = 0
    updated = 0
    errors = 0

    for standard in standards:
        payload = {
            "standard_name": standard["standard_name"],
            "publisher": standard["publisher"],
            "version": standard["version"],
            "source_type": standard["source_type"],
            "jurisdiction": standard["jurisdiction"],
            "effective_date": standard.get("effective_date"),
            "source_currency_status": standard["source_currency_status"],
            "rules": json.dumps(standard["rules"]),
            "metadata": json.dumps(standard["metadata"]),
        }

        # Check existence
        check_url = f"{rest_url}?standard_name=eq.{standard['standard_name']}&version=eq.{standard['version']}&select=id"
        resp = requests.get(check_url, headers=headers)
        exists = resp.status_code == 200 and len(resp.json()) > 0

        if exists:
            # Update
            where = f"?standard_name=eq.{standard['standard_name']}&version=eq.{standard['version']}"
            resp = requests.patch(f"{rest_url}{where}", headers=headers, json=payload)
            if resp.status_code in (200, 204):
                print(f"    → Updated: {standard['standard_name']} v{standard['version']}")
                updated += 1
            else:
                print(f"    ✗ Failed to update {standard['standard_name']}: {resp.status_code}")
                errors += 1
        else:
            # Insert
            resp = requests.post(rest_url, headers=headers, json=payload)
            if resp.status_code in (200, 201):
                print(f"    → Created: {standard['standard_name']} v{standard['version']}")
                created += 1
            else:
                print(f"    ✗ Failed to create {standard['standard_name']}: {resp.status_code}")
                errors += 1

    return created, updated, errors


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    env = load_env()
    if not env.get("SUPABASE_URL") or not env.get("SUPABASE_SERVICE_ROLE_KEY"):
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env")
        sys.exit(1)

    print("=" * 60)
    print("Rulebook Pipeline: PDF → JSON → Supabase")
    print("=" * 60)

    # Ensure directories exist
    for d in [SOURCES_DIR, EXTRACTED_DIR, CURATED_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    # Step 1: Extract PDFs
    print("\n[1/4] Extracting PDFs to text...")
    extracted = extract_pdfs()
    if not extracted:
        print("  No PDFs to extract.")

    # Step 2: Read curated JSONs
    print("\n[2/4] Reading curated rulebook JSONs...")
    standards = read_curated_jsons()
    if not standards:
        print("  No standards found. Add curated JSON files to curated/")
        sys.exit(0)

    # Step 3: Generate consolidated rulebook.json
    print("\n[3/4] Generating consolidated rulebook...")
    rulebook_path = generate_rulebook_json(standards)

    # Step 4: Upsert to Supabase
    print(f"\n[4/4] Uploading to Supabase ({supabase_url(env)})...")
    created, updated, errors = upsert_to_supabase(standards, env)

    # Summary
    total_rules = sum(len(s["rules"]) for s in standards)
    print(f"\n{'=' * 60}")
    print(f"Pipeline complete:")
    print(f"  Standards: {len(standards)} | Rules: {total_rules}")
    print(f"  Supabase: {created} created, {updated} updated, {errors} errors")
    print(f"  Rulebook: {rulebook_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
