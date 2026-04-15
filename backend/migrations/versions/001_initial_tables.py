"""initial_tables

Revision ID: 001_initial
Revises: 
Create Date: 2026-04-14 00:00:00.000000

Creates all tables defined in the SQLModel models:
- tenant, notification (supporting.py)
- site, upload, reading, finding, report (workflow_b.py)
- reference_source, citation_unit, rulebook_entry (workflow_a.py)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── tenant (from supporting.py) ──────────────────────────────────────
    op.create_table(
        'tenant',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('tenant_name', sa.String(), nullable=False),
        sa.Column('contact_email', sa.String(), nullable=False),
        sa.Column('certification_due_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # ── notification (from supporting.py) ────────────────────────────────
    op.create_table(
        'notification',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('tenant_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('tenant.id'), nullable=True),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('body', sa.String(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # ── site (from workflow_b.py) ────────────────────────────────────────
    op.create_table(
        'site',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('tenant_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('tenant.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # ── upload (from workflow_b.py) ──────────────────────────────────────
    op.create_table(
        'upload',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('site_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('site.id'), nullable=False),
        sa.Column('file_name', sa.String(), nullable=False),
        sa.Column('uploaded_by', sa.String(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.Column('parse_status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('parse_outcome', sa.String(), nullable=True),
        sa.Column('rule_version_used', sa.String(), nullable=True),
        sa.Column('warnings', sa.String(), nullable=True),
    )

    # ── reading (from workflow_b.py) ─────────────────────────────────────
    op.create_table(
        'reading',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('upload_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('upload.id'), nullable=False),
        sa.Column('site_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('site.id'), nullable=False),
        sa.Column('device_id', sa.String(), nullable=False),
        sa.Column('reading_timestamp', sa.DateTime(), nullable=False),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('metric_unit', sa.String(), nullable=False),
        sa.Column('is_outlier', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # ── finding (from workflow_b.py) ─────────────────────────────────────
    op.create_table(
        'finding',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('upload_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('upload.id'), nullable=False),
        sa.Column('site_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('site.id'), nullable=False),
        sa.Column('zone_name', sa.String(), nullable=False),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('threshold_band', sa.String(), nullable=False),
        sa.Column('interpretation_text', sa.String(), nullable=False),
        sa.Column('workforce_impact_text', sa.String(), nullable=False),
        sa.Column('recommended_action', sa.String(), nullable=False),
        sa.Column('rule_id', sa.String(), nullable=False),
        sa.Column('rule_version', sa.String(), nullable=False),
        sa.Column('citation_unit_ids', sa.String(), nullable=False),
        sa.Column('confidence_level', sa.String(), nullable=False),
        sa.Column('source_currency_status', sa.String(), nullable=False),
        sa.Column('benchmark_lane', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # ── report (from workflow_b.py) ──────────────────────────────────────
    op.create_table(
        'report',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('report_type', sa.String(), nullable=False, server_default='ASSESSMENT'),
        sa.Column('upload_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('upload.id'), unique=True, nullable=False),
        sa.Column('site_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('site.id'), nullable=False),
        sa.Column('report_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('rule_version_used', sa.String(), nullable=False),
        sa.Column('citation_ids_used', sa.String(), nullable=False),
        sa.Column('reviewer_name', sa.String(), nullable=True),
        sa.Column('reviewer_status', sa.String(), nullable=False, server_default='DRAFT_GENERATED'),
        sa.Column('reviewer_approved_at', sa.DateTime(), nullable=True),
        sa.Column('pdf_url', sa.String(), nullable=True),
        sa.Column('generated_at', sa.DateTime(), nullable=False),
    )

    # ── reference_source (from workflow_a.py) ────────────────────────────
    op.create_table(
        'reference_source',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('publisher', sa.String(), nullable=False),
        sa.Column('source_type', sa.String(), nullable=False),
        sa.Column('jurisdiction', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=True),
        sa.Column('file_storage_key', sa.String(), nullable=True),
        sa.Column('checksum', sa.String(), nullable=True),
        sa.Column('version_label', sa.String(), nullable=True),
        sa.Column('published_date', sa.DateTime(), nullable=True),
        sa.Column('effective_date', sa.DateTime(), nullable=True),
        sa.Column('ingested_at', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('source_currency_status', sa.String(), nullable=False),
        sa.Column('source_completeness_status', sa.String(), nullable=True),
        sa.Column('last_verified_at', sa.DateTime(), nullable=True),
    )

    # ── citation_unit (from workflow_a.py) ───────────────────────────────
    op.create_table(
        'citation_unit',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('source_id', sqlmodel.sql.sqltypes.GUID(), sa.ForeignKey('reference_source.id'), nullable=False),
        sa.Column('page_or_section', sa.String(), nullable=True),
        sa.Column('exact_excerpt', sa.String(), nullable=False),
        sa.Column('metric_tags', sa.String(), nullable=False),
        sa.Column('condition_tags', sa.String(), nullable=False),
        sa.Column('extracted_threshold_value', sa.Float(), nullable=True),
        sa.Column('extracted_unit', sa.String(), nullable=True),
        sa.Column('extraction_confidence', sa.Float(), nullable=True),
        sa.Column('extractor_version', sa.String(), nullable=True),
        sa.Column('needs_review', sa.Boolean(), nullable=False, server_default='true'),
    )

    # ── rulebook_entry (from workflow_a.py) ──────────────────────────────
    op.create_table(
        'rulebook_entry',
        sa.Column('id', sqlmodel.sql.sqltypes.GUID(), primary_key=True),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('threshold_type', sa.String(), nullable=False),
        sa.Column('min_value', sa.Float(), nullable=True),
        sa.Column('max_value', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('context_scope', sa.String(), nullable=False),
        sa.Column('interpretation_template', sa.String(), nullable=False),
        sa.Column('business_impact_template', sa.String(), nullable=False),
        sa.Column('recommendation_template', sa.String(), nullable=False),
        sa.Column('priority_logic', sa.String(), nullable=False),
        sa.Column('index_weight_percent', sa.Float(), nullable=True),
        sa.Column('confidence_level', sa.String(), nullable=False),
        sa.Column('rule_version', sa.String(), nullable=False),
        sa.Column('effective_from', sa.DateTime(), nullable=False),
        sa.Column('effective_to', sa.DateTime(), nullable=True),
        sa.Column('approval_status', sa.String(), nullable=False),
        sa.Column('approved_by', sa.String(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('rulebook_entry')
    op.drop_table('citation_unit')
    op.drop_table('reference_source')
    op.drop_table('report')
    op.drop_table('finding')
    op.drop_table('reading')
    op.drop_table('upload')
    op.drop_table('site')
    op.drop_table('notification')
    op.drop_table('tenant')
