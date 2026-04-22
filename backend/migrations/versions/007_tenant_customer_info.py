"""add_customer_info_to_tenant

Revision ID: 007_tenant_customer_info
Revises: 006_reading_zone_name
Create Date: 2026-04-22

Adds customer information columns to the tenant table for professional report generation.
All fields are nullable for backward compatibility with existing tenants.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '007_tenant_customer_info'
down_revision: Union[str, None] = '006_reading_zone_name'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenant', sa.Column('client_name', sa.String(), nullable=True))
    op.add_column('tenant', sa.Column('site_address', sa.String(), nullable=True))
    op.add_column('tenant', sa.Column('premises_type', sa.String(), nullable=True))
    op.add_column('tenant', sa.Column('contact_person', sa.String(), nullable=True))
    op.add_column('tenant', sa.Column('specific_event', sa.String(), nullable=True))
    op.add_column('tenant', sa.Column('comparative_analysis', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('tenant', 'comparative_analysis')
    op.drop_column('tenant', 'specific_event')
    op.drop_column('tenant', 'contact_person')
    op.drop_column('tenant', 'premises_type')
    op.drop_column('tenant', 'site_address')
    op.drop_column('tenant', 'client_name')
