"""
backend/tests/test_r1_03_schema_additions.py

Tests for PR-R1-03 schema additions:
- Migration 008: site.context_scope, site.standard_ids
- Migration 009: upload.scan_type, upload.standards_evaluated
- Migration 010: site_metric_preferences table
- Migration 011: site_standards table
- Model classes: SiteMetricPreferences, SiteStandards
- Enum: ScanType
"""

from sqlalchemy import inspect


class TestMigration008SiteContext:
    """Verify migration 008 adds context_scope and standard_ids to site table."""

    def test_site_has_context_scope_column(self, engine):
        columns = inspect(engine).get_columns("site")
        col_names = [c["name"] for c in columns]
        assert "context_scope" in col_names, "site table should have context_scope column"

    def test_site_has_standard_ids_column(self, engine):
        columns = inspect(engine).get_columns("site")
        col_names = [c["name"] for c in columns]
        assert "standard_ids" in col_names, "site table should have standard_ids column"

    def test_context_scope_allows_null(self, engine):
        columns = inspect(engine).get_columns("site")
        ctx_col = next(c for c in columns if c["name"] == "context_scope")
        assert ctx_col["nullable"], "context_scope should be nullable"

    def test_standard_ids_allows_null(self, engine):
        columns = inspect(engine).get_columns("site")
        std_col = next(c for c in columns if c["name"] == "standard_ids")
        assert std_col["nullable"], "standard_ids should be nullable"


class TestMigration009ScanType:
    """Verify migration 009 adds scan_type and standards_evaluated to upload table."""

    def test_upload_has_scan_type_column(self, engine):
        columns = inspect(engine).get_columns("upload")
        col_names = [c["name"] for c in columns]
        assert "scan_type" in col_names, "upload table should have scan_type column"

    def test_upload_has_standards_evaluated_column(self, engine):
        columns = inspect(engine).get_columns("upload")
        col_names = [c["name"] for c in columns]
        assert "standards_evaluated" in col_names, "upload table should have standards_evaluated column"

    def test_scan_type_allows_null(self, engine):
        columns = inspect(engine).get_columns("upload")
        st_col = next(c for c in columns if c["name"] == "scan_type")
        assert st_col["nullable"], "scan_type should be nullable"

    def test_standards_evaluated_allows_null(self, engine):
        columns = inspect(engine).get_columns("upload")
        se_col = next(c for c in columns if c["name"] == "standards_evaluated")
        assert se_col["nullable"], "standards_evaluated should be nullable"


class TestMigration010SiteMetricPreferences:
    """Verify migration 010 creates site_metric_preferences table."""

    def test_table_exists(self, engine):
        table_names = inspect(engine).get_table_names()
        assert "site_metric_preferences" in table_names

    def test_columns_exist(self, engine):
        columns = inspect(engine).get_columns("site_metric_preferences")
        col_names = [c["name"] for c in columns]
        for expected in ["id", "site_id", "active_metrics", "alert_threshold_overrides", "created_at", "updated_at"]:
            assert expected in col_names, f"site_metric_preferences missing column: {expected}"

    def test_site_id_is_unique(self, engine):
        """site_id should have a UNIQUE constraint (one row per site)."""
        constraints = inspect(engine).get_unique_constraints("site_metric_preferences")
        # Check that site_id appears in a unique constraint
        unique_cols = set()
        for constraint in constraints:
            unique_cols.update(constraint["column_names"])
        assert "site_id" in unique_cols, "site_id should be UNIQUE in site_metric_preferences"

    def test_site_id_not_nullable(self, engine):
        columns = inspect(engine).get_columns("site_metric_preferences")
        site_col = next(c for c in columns if c["name"] == "site_id")
        assert not site_col["nullable"], "site_id should be NOT NULL"


class TestMigration011SiteStandards:
    """Verify migration 011 creates site_standards table."""

    def test_table_exists(self, engine):
        table_names = inspect(engine).get_table_names()
        assert "site_standards" in table_names

    def test_columns_exist(self, engine):
        columns = inspect(engine).get_columns("site_standards")
        col_names = [c["name"] for c in columns]
        for expected in ["id", "site_id", "reference_source_id", "is_active", "created_at"]:
            assert expected in col_names, f"site_standards missing column: {expected}"

    def test_composite_unique_constraint(self, engine):
        """(site_id, reference_source_id) should be UNIQUE."""
        constraints = inspect(engine).get_unique_constraints("site_standards")
        found = False
        for constraint in constraints:
            cols = set(constraint["column_names"])
            if cols == {"site_id", "reference_source_id"}:
                found = True
                break
        assert found, "site_standards should have UNIQUE(site_id, reference_source_id)"

    def test_is_active_default_true(self, engine):
        columns = inspect(engine).get_columns("site_standards")
        active_col = next(c for c in columns if c["name"] == "is_active")
        assert active_col.get("default") is not None or active_col.get("server_default") is not None, \
            "is_active should have a default value"


class TestModelImports:
    """Verify SQLModel classes import without error."""

    def test_site_metric_preferences_import(self):
        from app.models.supporting import SiteMetricPreferences
        assert SiteMetricPreferences.__tablename__ == "site_metric_preferences"

    def test_site_standards_import(self):
        from app.models.supporting import SiteStandards
        assert SiteStandards.__tablename__ == "site_standards"

    def test_site_has_new_fields(self):
        from app.models.workflow_b import Site
        field_names = set(Site.model_fields.keys())
        assert "context_scope" in field_names
        assert "standard_ids" in field_names

    def test_upload_has_new_fields(self):
        from app.models.workflow_b import Upload
        field_names = set(Upload.model_fields.keys())
        assert "scan_type" in field_names
        assert "standards_evaluated" in field_names

    def test_scan_type_enum(self):
        from app.models.enums import ScanType
        assert ScanType.adhoc.value == "adhoc"
        assert ScanType.continuous.value == "continuous"
