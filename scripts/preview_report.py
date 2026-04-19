"""
scripts/preview_report.py

Renders a report HTML template with sample data to PDF for visual inspection.

Usage:
    python scripts/preview_report.py --template assessment.html --data assets/sample_finding_data.json --output preview.pdf
    python scripts/preview_report.py --template intervention_impact.html --data assets/sample_finding_data.json --output preview_intervention.pdf

Requires: WeasyPrint installed (`pip install weasyprint`).
          Jinja2 templates in backend/app/templates/.
"""

import argparse
import json
import os
import sys

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


def render_preview(template_name: str, data_path: str, output_path: str) -> None:
    from jinja2 import Environment, FileSystemLoader
    from weasyprint import HTML

    template_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "templates")

    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template(template_name)

    with open(data_path, "r") as f:
        data = json.load(f)

    html_content = template.render(**data)

    # Write HTML for inspection
    html_output = output_path.replace(".pdf", ".html")
    with open(html_output, "w") as f:
        f.write(html_content)
    print(f"HTML preview written to: {html_output}")

    # Render PDF
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf()

    with open(output_path, "wb") as f:
        f.write(pdf_bytes)

    print(f"PDF preview written to: {output_path}")
    print(f"PDF size: {len(pdf_bytes)} bytes")
    if pdf_bytes[:4] == b"%PDF":
        print("PDF validation: OK (starts with %PDF header)")
    else:
        print("PDF validation: FAILED (invalid PDF header)")


def main():
    parser = argparse.ArgumentParser(description="Preview a report template as PDF")
    parser.add_argument("--template", required=True, help="Template filename (e.g., assessment.html)")
    parser.add_argument("--data", required=True, help="Path to sample finding data JSON")
    parser.add_argument("--output", default="preview.pdf", help="Output PDF path")
    args = parser.parse_args()

    if not os.path.exists(args.data):
        print(f"[ERROR] Data file not found: {args.data}")
        sys.exit(1)

    try:
        render_preview(args.template, args.data, args.output)
    except ImportError as e:
        print(f"[ERROR] Missing dependency: {e}")
        print("Install with: pip install weasyprint jinja2")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Failed to render preview: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
