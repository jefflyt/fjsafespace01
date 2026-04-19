"""add performance indexes to finding and report tables

Revision ID: 003_add_indexes
Revises: 002_report_qa_fields
Create Date: 2026-04-19 00:00:00.000000

Adds indexes defined in SQLModel __table_args__ that were missing
from the initial migration:
- finding: ix_finding_site_id, ix_finding_created_at, ix_finding_rule_version, ix_finding_site_created
- report: ix_report_site_id, ix_report_generated_at
"""
from typing import Sequence, Union

from alembic import op


revision: str = '003_add_indexes'
down_revision: Union[str, None] = '002_report_qa_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── finding indexes ──────────────────────────────────────────────────
    op.create_index('ix_finding_site_id', 'finding', ['site_id'])
    op.create_index('ix_finding_created_at', 'finding', ['created_at'])
    op.create_index('ix_finding_rule_version', 'finding', ['rule_version'])
    op.create_index('ix_finding_site_created', 'finding', ['site_id', 'created_at'])

    # ── report indexes ───────────────────────────────────────────────────
    op.create_index('ix_report_site_id', 'report', ['site_id'])
    op.create_index('ix_report_generated_at', 'report', ['generated_at'])


def downgrade() -> None:
    op.drop_index('ix_report_generated_at', 'report')
    op.drop_index('ix_report_site_id', 'report')
    op.drop_index('ix_finding_site_created', 'finding')
    op.drop_index('ix_finding_rule_version', 'finding')
    op.drop_index('ix_finding_created_at', 'finding')
    op.drop_index('ix_finding_site_id', 'finding')
