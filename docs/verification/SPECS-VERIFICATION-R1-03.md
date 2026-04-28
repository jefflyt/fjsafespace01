# Spec Verification: PR-R1-03 — Schema Additions (Preferences, Standards, Context)

## Acceptance Criteria Verification

| PSD Requirement | Plan | Test | Code | Status |
|-----------------|------|------|------|--------|
| `site_metric_preferences` table exists with UNIQUE site_id, active_metrics TEXT[], alert_threshold_overrides JSONB | [§3 Step 3](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | [TestMigration010SiteMetricPreferences](backend/tests/test_r1_03_schema_additions.py) | [010_site_metric_preferences.py](backend/migrations/versions/010_site_metric_preferences.py) | ✅ Complete |
| `site_standards` table exists with UNIQUE (site_id, reference_source_id) constraint | [§3 Step 4](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | [TestMigration011SiteStandards](backend/tests/test_r1_03_schema_additions.py) | [011_site_standards.py](backend/migrations/versions/011_site_standards.py) | ✅ Complete |
| `site` table has new columns: context_scope TEXT, standard_ids TEXT[] | [§3 Step 1](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | [TestMigration008SiteContext](backend/tests/test_r1_03_schema_additions.py) | [008_site_context.py](backend/migrations/versions/008_site_context.py) | ✅ Complete |
| `upload` table has new columns: scan_type TEXT, standards_evaluated TEXT[] | [§3 Step 2](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | [TestMigration009ScanType](backend/tests/test_r1_03_schema_additions.py) | [009_scan_type.py](backend/migrations/versions/009_scan_type.py) | ✅ Complete |
| All migrations apply cleanly on existing data (additive, nullable columns with defaults) | [§3 AC 5](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | All migration tests | 4 new migrations | ✅ Complete |
| SQLModel classes reflect new schema | [§3 AC 6](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | [TestModelImports](backend/tests/test_r1_03_schema_additions.py) | [workflow_b.py](backend/app/models/workflow_b.py), [supporting.py](backend/app/models/supporting.py) | ✅ Complete |
| `ScanType` enum: adhoc, continuous | [§3 Step 7](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | [test_scan_type_enum](backend/tests/test_r1_03_schema_additions.py) | [enums.py](backend/app/models/enums.py) | ✅ Complete |
| No frontend changes (purely schema) | [§3 Frontend](docs/plans/epics/R1-Refactor/pr03-schema-additions.md) | N/A | No frontend files changed | ✅ Complete |

## Summary

All 8 acceptance criteria verified. 21 tests pass. Linter clean. Upgrade and downgrade cycles confirmed working.

### Spec Divergence Notes

- **Migration 015 fix**: Fixed pre-existing type mismatch in `015_rulebook_standard_link.py` where `sa.Uuid(as_uuid=True)` was used for a column referencing `reference_source.id` (VARCHAR). Changed to `sa.String(36)` to match the FK target type. This is a bug fix from PR-R1-02, not a scope change.
- **Migration chain threading**: New migrations 008-011 inserted between 007 and 014. Updated `014_user_tenant.py` `down_revision` from `007_tenant_customer_info` to `011_site_standards`.
