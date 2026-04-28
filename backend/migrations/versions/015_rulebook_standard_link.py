"""015_rulebook_standard_link

Add reference_source_id FK to rulebook_entry table to link rules to their
parent certification standard (SS 554, WELL v2, RESET, SafeSpace).

Reference: PR-R1-02 plan
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision = "015_rulebook_standard_link"
down_revision = "014_user_tenant"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Use raw SQL for idempotency — column may already exist from prior partial application
    op.execute(
        "ALTER TABLE rulebook_entry ADD COLUMN IF NOT EXISTS reference_source_id UUID"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_rulebook_entry_reference_source_id ON rulebook_entry (reference_source_id)"
    )


def downgrade() -> None:
    op.drop_index("ix_rulebook_entry_reference_source_id", table_name="rulebook_entry")
    op.drop_column("rulebook_entry", "reference_source_id")
