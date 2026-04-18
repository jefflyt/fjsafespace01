"""add qa_checks, data_quality_statement, certification_outcome to report

Revision ID: 002_report_qa_fields
Revises: 001_initial
Create Date: 2026-04-18 00:00:00.000000

Adds QA checklist and certification outcome columns to the report table
to support the Report Draft Builder & QA Checklist (PR4).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '002_report_qa_fields'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('report', sa.Column('qa_checks', sa.String(), nullable=False, server_default='{}'))
    op.add_column('report', sa.Column('data_quality_statement', sa.String(), nullable=True))
    op.add_column('report', sa.Column('certification_outcome', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('report', 'certification_outcome')
    op.drop_column('report', 'data_quality_statement')
    op.drop_column('report', 'qa_checks')
