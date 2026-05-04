"""018_upload_batch_multi_site

Create upload_batch table for grouping child uploads from a single CSV.
Add batch_id and zone_list columns to upload table.

All uploads (single-zone and multi-zone) now use the batch model:
- Single-zone: batch with 1 child upload
- Multi-zone: batch with N child uploads (one per assigned site)
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision = "018_upload_batch_multi_site"
down_revision = "017_upload_content_hash"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Create upload_batch table
    op.create_table(
        "upload_batch",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("file_name", sa.Text(), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("tenant_id", sa.String(length=36), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("child_upload_ids", sa.ARRAY(sa.Text()), nullable=True),
    )

    # Add batch_id and zone_list to upload table
    op.add_column(
        "upload",
        sa.Column("batch_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "upload",
        sa.Column("zone_list", sa.ARRAY(sa.Text()), nullable=True),
    )

    # Add FK constraint for batch_id
    op.create_foreign_key(
        "fk_upload_batch_id",
        "upload",
        "upload_batch",
        ["batch_id"],
        ["id"],
    )

    # Index on batch_id for fast child lookup
    op.create_index(
        "ix_upload_batch_id",
        "upload",
        ["batch_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_upload_batch_id", "upload")
    op.drop_constraint("fk_upload_batch_id", "upload", type_="foreignkey")
    op.drop_column("upload", "zone_list")
    op.drop_column("upload", "batch_id")
    op.drop_table("upload_batch")
