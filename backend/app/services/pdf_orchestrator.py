"""
backend/app/services/pdf_orchestrator.py

WeasyPrint PDF generation engine for FJDashboard reports.

Provides:
- Jinja2 template environment configured for the backend/templates/ directory.
- render_pdf() — compiles a named template + context into PDF bytes.

Phase 1: Only renders a static hello-world template to verify the pipeline.
Phase 2: Will hydrate templates with Report/Finding data models.
"""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# Resolve templates directory relative to this file's location
_TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates"

jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=True,
)


def render_pdf(template_name: str, context: dict | None = None) -> bytes:
    """
    Render a Jinja2 template into PDF bytes using WeasyPrint.

    Args:
        template_name: Path relative to templates/ (e.g. "base.html").
        context: Variables injected into the Jinja2 template.

    Returns:
        Raw PDF bytes ready for streaming or file save.
    """
    template = jinja_env.get_template(template_name)
    html_string = template.render(context or {})
    pdf_bytes = HTML(string=html_string, base_url=str(_TEMPLATE_DIR)).write_pdf()
    return pdf_bytes
