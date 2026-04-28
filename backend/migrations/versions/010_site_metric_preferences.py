"""create_site_metric_preferences

Revision ID: 010_site_metric_preferences
Revises: 009_scan_type
Create Date: 2026-04-28

Creates the site_metric_preferences table for per-site metric visibility
and alert threshold customization.
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "010_site_metric_preferences"
down_revision: str = "009_scan_type"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "site_metric_preferences",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site_id", sa.Uuid(), sa.ForeignKey("site.id"), nullable=False),
        sa.Column(
            "active_metrics",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "alert_threshold_overrides",
            sa.JSON(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_site_metric_preferences_site_id",
        "site_metric_preferences",
        ["site_id"],
    )


def downgrade() -> None:
    op.drop_table("site_metric_preferences")
