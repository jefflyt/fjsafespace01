"""add_site_context

Revision ID: 008_site_context
Revises: 007_tenant_customer_info
Create Date: 2026-04-28

Adds context_scope and standard_ids columns to the site table for
per-site standard selection and context filtering.
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "008_site_context"
down_revision: str = "007_tenant_customer_info"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "site",
        sa.Column("context_scope", sa.Text(), nullable=True, server_default="general"),
    )
    op.add_column(
        "site",
        sa.Column("standard_ids", sa.ARRAY(sa.Text()), nullable=True, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("site", "standard_ids")
    op.drop_column("site", "context_scope")
