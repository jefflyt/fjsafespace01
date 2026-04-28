"""create_site_standards

Revision ID: 011_site_standards
Revises: 010_site_metric_preferences
Create Date: 2026-04-28

Creates the site_standards table linking sites to their active certification
standards (SS 554, WELL v2, RESET, SafeSpace).
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "011_site_standards"
down_revision: str = "010_site_metric_preferences"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "site_standards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site_id", sa.Uuid(), sa.ForeignKey("site.id"), nullable=False),
        sa.Column(
            "reference_source_id",
            sa.Uuid(),
            sa.ForeignKey("reference_source.id"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_site_standards_site_reference",
        "site_standards",
        ["site_id", "reference_source_id"],
    )


def downgrade() -> None:
    op.drop_table("site_standards")
