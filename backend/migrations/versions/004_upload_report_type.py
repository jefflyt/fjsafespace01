"""add report_type column to upload table

Revision ID: 004_upload_report_type
Revises: 003_add_indexes
Create Date: 2026-04-19 00:00:00.000000

Adds report_type enum column to upload table for auto-detected report type.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '004_upload_report_type'
down_revision: Union[str, None] = '003_add_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type if it doesn't exist (PostgreSQL)
    # Using sa.Enum to create the type first
    report_type_enum = sa.Enum('ASSESSMENT', 'INTERVENTION_IMPACT', name='reporttype')
    report_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('upload', sa.Column('report_type', report_type_enum, nullable=True))


def downgrade() -> None:
    op.drop_column('upload', 'report_type')
