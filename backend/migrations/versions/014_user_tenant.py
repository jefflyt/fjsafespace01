"""014_user_tenant

Create user_tenant mapping table for Supabase Auth → tenant association.

Reference: TDD §3.4 (user_tenant)
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision = "014_user_tenant"
down_revision = "007_tenant_customer_info"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_tenant",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("supabase_user_id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenant.id"), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="facility_manager"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_tenant_supabase_user_id", "user_tenant", ["supabase_user_id"], unique=True)


def downgrade() -> None:
    op.drop_table("user_tenant")
