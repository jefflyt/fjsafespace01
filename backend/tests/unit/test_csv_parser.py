"""
backend/tests/unit/test_csv_parser.py

Unit tests for the CSV parsing service.

Tests cover:
- Successful parsing with valid data
- Missing column detection and FAIL outcome
- Outlier detection and PASS_WITH_WARNINGS outcome
- Invalid value handling and row-level failures
- Empty CSV and malformed file handling

Reference: TDD §4.1, §8.1
"""

from io import BytesIO

import pytest

from app.models.enums import ParseOutcome
from app.services.csv_parser import parse_csv


def create_csv_bytes(content: str) -> BytesIO:
    """Helper: convert CSV string to BytesIO with UTF-8 encoding."""
    return BytesIO(content.encode("utf-8"))


# ── Valid CSV parsing ─────────────────────────────────────────────────────────


def test_parse_csv_valid_no_warnings():
    """All required columns present, valid data, no outliers → PASS."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,450,12.5,200,22.5,55.0
DEV001,2024-01-15T10:05:00Z,Conference Room A,460,13.0,210,22.8,54.5
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.PASS
    assert result.failed_row_count == 0
    assert len(result.warnings) == 0
    # 2 rows × 5 metrics = 10 normalised rows
    assert len(result.normalised_rows) == 10


def test_parse_csv_valid_with_outliers():
    """Valid data with some outliers → PASS_WITH_WARNINGS."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,450,12.5,200,22.5,55.0
DEV001,2024-01-15T10:05:00Z,Conference Room A,5500,13.0,210,22.8,54.5
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.PASS_WITH_WARNINGS
    assert result.failed_row_count == 0
    assert len(result.warnings) > 0  # CO2 outlier warning
    # Should still have 10 normalised rows (outlier doesn't exclude the row)
    assert len(result.normalised_rows) == 10
    # Check that the outlier row is flagged
    co2_rows = [r for r in result.normalised_rows if r["metric_name"] == "co2_ppm"]
    assert any(r["is_outlier"] for r in co2_rows)


def test_parse_csv_valid_with_invalid_values():
    """Some rows have invalid values → PASS_WITH_WARNINGS."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,450,12.5,200,22.5,55.0
DEV001,2024-01-15T10:05:00Z,Conference Room A,invalid,13.0,210,22.8,54.5
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.PASS_WITH_WARNINGS
    assert result.failed_row_count == 1
    assert len(result.warnings) > 0  # Invalid value warning


# ── Missing column detection ──────────────────────────────────────────────────


def test_parse_csv_missing_column():
    """Missing required column → FAIL."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3
DEV001,2024-01-15T10:00:00Z,Conference Room A,450,12.5
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.FAIL
    assert len(result.warnings) == 1
    assert "tvoc_ppb" in result.warnings[0]
    assert "temperature_c" in result.warnings[0]
    assert "humidity_rh" in result.warnings[0]
    assert len(result.normalised_rows) == 0


def test_parse_csv_missing_multiple_columns():
    """Missing multiple required columns → FAIL."""
    csv_content = """device_id,timestamp,zone_name
DEV001,2024-01-15T10:00:00Z,Conference Room A
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.FAIL
    assert "co2_ppm" in result.warnings[0]
    assert len(result.normalised_rows) == 0


# ── Malformed file handling ───────────────────────────────────────────────────


def test_parse_csv_invalid_file_format():
    """Non-CSV content → FAIL with parse error."""
    csv_content = "This is not a CSV file\nJust plain text\n"
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.FAIL
    assert len(result.warnings) > 0


def test_parse_csv_empty_file():
    """Empty file → FAIL."""
    csv_content = ""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.FAIL
    assert len(result.warnings) > 0


# ── Outlier detection ─────────────────────────────────────────────────────────


def test_parse_csv_outlier_co2_too_high():
    """CO2 > 5000 ppm → flagged as outlier with warning."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,6000,12.5,200,22.5,55.0
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.PASS_WITH_WARNINGS
    co2_rows = [r for r in result.normalised_rows if r["metric_name"] == "co2_ppm"]
    assert len(co2_rows) == 1
    assert co2_rows[0]["is_outlier"] is True
    assert co2_rows[0]["metric_value"] == 6000.0


def test_parse_csv_outlier_negative_value():
    """Negative CO2 value → flagged as outlier with warning."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,-100,12.5,200,22.5,55.0
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.PASS_WITH_WARNINGS
    co2_rows = [r for r in result.normalised_rows if r["metric_name"] == "co2_ppm"]
    assert len(co2_rows) == 1
    assert co2_rows[0]["is_outlier"] is True


def test_parse_csv_outlier_pm25_too_high():
    """PM2.5 > 500 μg/m³ → flagged as outlier with warning."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,450,600,200,22.5,55.0
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.PASS_WITH_WARNINGS
    pm25_rows = [r for r in result.normalised_rows if r["metric_name"] == "pm25_ugm3"]
    assert len(pm25_rows) == 1
    assert pm25_rows[0]["is_outlier"] is True


# ── All rows failed ───────────────────────────────────────────────────────────


def test_parse_csv_all_rows_failed():
    """All rows have invalid values → FAIL."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,invalid,invalid,invalid,invalid,invalid
DEV001,2024-01-15T10:05:00Z,Conference Room A,bad,bad,bad,bad,bad
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert result.parse_outcome == ParseOutcome.FAIL
    assert result.failed_row_count == 2


# ── Normalised row structure ──────────────────────────────────────────────────


def test_parse_csv_normalised_row_structure():
    """Each normalised row should have the correct structure."""
    csv_content = """device_id,timestamp,zone_name,co2_ppm,pm2_5_ugm3,tvoc_ppb,temperature_c,humidity_rh
DEV001,2024-01-15T10:00:00Z,Conference Room A,450,12.5,200,22.5,55.0
"""
    result = parse_csv(create_csv_bytes(csv_content), "site-123", "upload-456")

    assert len(result.normalised_rows) == 5  # 5 metrics per row

    row = result.normalised_rows[0]
    assert "device_id" in row
    assert "zone_name" in row
    assert "reading_timestamp" in row
    assert "site_id" in row
    assert "upload_id" in row
    assert "metric_name" in row
    assert "metric_value" in row
    assert "metric_unit" in row
    assert "is_outlier" in row

    # Check site_id and upload_id are correctly set
    assert row["site_id"] == "site-123"
    assert row["upload_id"] == "upload-456"
    assert row["device_id"] == "DEV001"
    assert row["zone_name"] == "Conference Room A"
