"""add scan_date to upload table

Revision ID: 021
Revises: 020
Create Date: 2026-05-11

Add scan_date column derived from the earliest reading_timestamp for each
upload. Replaces reliance on uploaded_at (filesystem arrival time) for
displaying actual scan dates.
"""

from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "upload",
        sa.Column("scan_date", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("upload", "scan_date")
