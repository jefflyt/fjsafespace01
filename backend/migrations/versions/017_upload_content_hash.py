"""017_upload_content_hash

Add content_hash column to upload table for CSV dedup detection.
Index on content_hash for fast lookup during tenant-scoped dedup checks.
Partial index only on COMPLETE uploads — avoids blocking retries on FAILED/PENDING.
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision = "017_upload_content_hash"
down_revision = "016_tenant_email_unique"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "upload",
        sa.Column("content_hash", sa.String(length=64), nullable=True),
    )
    # Partial index for fast dedup lookup — only COMPLETE uploads matter
    op.create_index(
        "ix_upload_content_hash",
        "upload",
        ["content_hash"],
        postgresql_where=sa.text("parse_status = 'COMPLETE'"),
    )


def downgrade() -> None:
    op.drop_index("ix_upload_content_hash", "upload")
    op.drop_column("upload", "content_hash")
