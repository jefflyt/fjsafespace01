"""replace pdf_url with report_snapshot on report table

Revision ID: 005_report_snapshot
Revises: 004_upload_report_type
Create Date: 2026-04-19 00:00:00.000000

Replaces pdf_url (Supabase Storage URL) with report_snapshot (immutable JSON
context) so PDFs are generated on-demand instead of stored permanently.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '005_report_snapshot'
down_revision: Union[str, None] = '004_upload_report_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the new snapshot column
    op.add_column('report', sa.Column('report_snapshot', sa.Text(), nullable=True))

    # Drop the old pdf_url column
    op.drop_column('report', 'pdf_url')


def downgrade() -> None:
    op.add_column('report', sa.Column('pdf_url', sa.String(), nullable=True))
    op.drop_column('report', 'report_snapshot')
