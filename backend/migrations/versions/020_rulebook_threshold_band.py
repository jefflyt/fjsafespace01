"""add threshold_band to rulebook_entry

Revision ID: 020
Revises: 019
Create Date: 2026-05-07

Add explicit threshold_band column (GOOD | WATCH | CRITICAL) to eliminate
heuristic band inference. Existing entries get NULL and are re-evaluated
on next seed.
"""

from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rulebook_entry",
        sa.Column("threshold_band", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("rulebook_entry", "threshold_band")
