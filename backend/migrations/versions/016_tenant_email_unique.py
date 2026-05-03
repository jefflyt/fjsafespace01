"""016_tenant_email_unique

Add UNIQUE constraint on tenant.contact_email for dedup key.
Handles existing duplicates by keeping the most recent tenant per email.
"""

from typing import Sequence

from alembic import op

revision = "016_tenant_email_unique"
down_revision = "015_rulebook_standard_link"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Step 1: Deduplicate — keep the most recent tenant per contact_email
    # Delete duplicates, keeping the one with the highest created_at
    op.execute("""
        DELETE FROM tenant
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY contact_email
                           ORDER BY created_at DESC
                       ) as rn
                FROM tenant
                WHERE contact_email IS NOT NULL
                  AND contact_email != ''
            ) sub
            WHERE rn > 1
        )
    """)

    # Step 2: Add UNIQUE constraint
    op.create_unique_constraint(
        "uq_tenant_contact_email",
        "tenant",
        ["contact_email"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_tenant_contact_email", "tenant", type_="unique")
