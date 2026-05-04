"""add reference_source_id to finding

Revision ID: 019
Revises: 018
Create Date: 2026-05-04

Add reference_source_id FK to finding table so findings carry their
certification standard attribution from evaluation time, eliminating
the need for the unreliable post-query lookup.
"""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018_upload_batch_multi_site"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "finding",
        sa.Column("reference_source_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_finding_reference_source",
        "finding",
        "reference_source",
        ["reference_source_id"],
        ["id"],
    )
    op.create_index(
        "ix_finding_reference_source_id",
        "finding",
        ["reference_source_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_finding_reference_source_id", table_name="finding")
    op.drop_constraint("fk_finding_reference_source", "finding", type_="foreignkey")
    op.drop_column("finding", "reference_source_id")
