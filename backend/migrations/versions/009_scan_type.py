"""add_scan_type_to_upload

Revision ID: 009_scan_type
Revises: 008_site_context
Create Date: 2026-04-28

Adds scan_type and standards_evaluated columns to the upload table for
tracking scan mode and which standards were evaluated.
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009_scan_type"
down_revision: str = "008_site_context"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "upload",
        sa.Column("scan_type", sa.Text(), nullable=True, server_default="adhoc"),
    )
    op.add_column(
        "upload",
        sa.Column("standards_evaluated", sa.ARRAY(sa.Text()), nullable=True, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("upload", "standards_evaluated")
    op.drop_column("upload", "scan_type")
