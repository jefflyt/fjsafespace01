"""
backend/scripts/test_hello_pdf.py

Smoke test for the WeasyPrint pipeline.
Generates a hello_world.pdf from base.html to verify the engine works.

Usage (from backend/):
    python scripts/test_hello_pdf.py

Output:
    backend/hello_world.pdf  (inspect visually)
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure the backend package is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.pdf_orchestrator import render_pdf

OUTPUT = Path(__file__).resolve().parent.parent / "hello_world.pdf"

context = {
    "title": "FJ SafeSpace — Pipeline Test",
    "generated_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    "message": "Hello, World! The WeasyPrint PDF generation pipeline is operational.",
}

try:
    pdf_bytes = render_pdf("base.html", context)
    OUTPUT.write_bytes(pdf_bytes)
    print(f"PDF written to {OUTPUT}  ({len(pdf_bytes):,} bytes)")
    print("Open the file and verify the title, date, and message render correctly.")
except Exception as exc:
    print(f"FAILED: {exc}", file=sys.stderr)
    sys.exit(1)
