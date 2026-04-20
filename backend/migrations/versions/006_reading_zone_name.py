"""add_zone_name_to_reading

Revision ID: 006_reading_zone_name
Revises: 005_report_snapshot
Create Date: 2026-04-20

Adds zone_name column to the reading table for time-series chart grouping.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '006_reading_zone_name'
down_revision: Union[str, None] = '005_report_snapshot'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reading', sa.Column('zone_name', sa.String(), nullable=False, server_default=''))


def downgrade() -> None:
    op.drop_column('reading', 'zone_name')
