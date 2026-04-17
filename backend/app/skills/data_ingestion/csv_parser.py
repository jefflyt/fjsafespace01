"""
backend/app/services/csv_parser.py

CSV parsing and validation service for uHoo IAQ data exports.

Responsibilities:
- Validate that required column headers are present
- Normalise readings into Reading model instances
- Flag implausible outliers (is_outlier = True)
- Produce parse warnings for non-fatal issues
- Return ParseOutcome: PASS | PASS_WITH_WARNINGS | FAIL

Expected CSV columns (uHoo export format):
  device_id, timestamp, zone_name, co2_ppm, pm2_5_ugm3, tvoc_ppb,
  temperature_c, humidity_rh

Reference: TDD §4.1 (POST /api/uploads processing)
"""

from dataclasses import dataclass, field
from typing import IO

import pandas as pd

from app.models.enums import ParseOutcome


REQUIRED_COLUMNS = {
    "device_id",
    "timestamp",
    "zone_name",
    "co2_ppm",
    "pm2_5_ugm3",
    "tvoc_ppb",
    "temperature_c",
    "humidity_rh",
}

# Outlier detection thresholds
OUTLIER_BOUNDS = {
    "co2_ppm": {"min": 300, "max": 5000},
    "pm2_5_ugm3": {"min": 0, "max": 500},
    "tvoc_ppb": {"min": 0, "max": 1000},
    "temperature_c": {"min": -10, "max": 60},
    "humidity_rh": {"min": 0, "max": 100},
}

# Map CSV column names to metric enum names and units
METRIC_MAP = [
    ("co2_ppm", "co2_ppm", "ppm"),
    ("pm2_5_ugm3", "pm25_ugm3", "μg/m³"),
    ("tvoc_ppb", "tvoc_ppb", "ppb"),
    ("temperature_c", "temperature_c", "°C"),
    ("humidity_rh", "humidity_rh", "%RH"),
]


@dataclass
class ParseResult:
    parse_outcome: ParseOutcome
    warnings: list[str] = field(default_factory=list)
    failed_row_count: int = 0
    normalised_rows: list[dict] = field(default_factory=list)


def parse_csv(file: IO[bytes], site_id: str, upload_id: str) -> ParseResult:
    """
    Parse a uHoo CSV export and return a ParseResult.

    - Reads file into pandas DataFrame
    - Validates required columns present → FAIL if missing
    - Parses timestamp to datetime
    - Detects outliers (e.g. CO2 > 5000 ppm, negative values)
    - Builds normalised_rows list (one dict per metric per row)
    - Sets ParseOutcome based on warning count and failed rows
    """
    warnings: list[str] = []
    failed_row_count = 0
    normalised_rows: list[dict] = []

    try:
        df = pd.read_csv(file)
    except Exception as e:
        return ParseResult(
            parse_outcome=ParseOutcome.FAIL,
            warnings=[f"Failed to read CSV: {str(e)}"],
            failed_row_count=0,
            normalised_rows=[],
        )

    # Validate required columns
    missing_columns = REQUIRED_COLUMNS - set(df.columns)
    if missing_columns:
        return ParseResult(
            parse_outcome=ParseOutcome.FAIL,
            warnings=[f"Missing required columns: {', '.join(sorted(missing_columns))}"],
            failed_row_count=0,
            normalised_rows=[],
        )

    # Parse timestamps
    try:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    except Exception as e:
        warnings.append(f"Timestamp parsing failed for some rows: {str(e)}")

    total_rows = len(df)

    for idx, row in df.iterrows():
        row_failed = False

        # Build base reading data
        reading_data = {
            "device_id": str(row["device_id"]),
            "zone_name": str(row["zone_name"]),
            "reading_timestamp": row["timestamp"],
            "site_id": site_id,
            "upload_id": upload_id,
        }

        # Process each metric and detect outliers
        for csv_col, metric_name, unit in METRIC_MAP:
            try:
                value = float(row[csv_col])
                is_outlier = False

                # Check outlier bounds
                if csv_col in OUTLIER_BOUNDS:
                    bounds = OUTLIER_BOUNDS[csv_col]
                    if value < bounds["min"] or value > bounds["max"]:
                        is_outlier = True
                        warnings.append(
                            f"Row {idx}: {csv_col}={value} is outside normal range "
                            f"[{bounds['min']}-{bounds['max']}]"
                        )

                normalised_rows.append({
                    **reading_data,
                    "metric_name": metric_name,
                    "metric_value": value,
                    "metric_unit": unit,
                    "is_outlier": is_outlier,
                })
            except (ValueError, TypeError):
                row_failed = True
                warnings.append(f"Row {idx}: Invalid value for {csv_col}: {row[csv_col]}")

        if row_failed:
            failed_row_count += 1

    # Determine outcome
    if failed_row_count == total_rows and total_rows > 0:
        outcome = ParseOutcome.FAIL
    elif warnings:
        outcome = ParseOutcome.PASS_WITH_WARNINGS
    else:
        outcome = ParseOutcome.PASS

    return ParseResult(
        parse_outcome=outcome,
        warnings=warnings,
        failed_row_count=failed_row_count,
        normalised_rows=normalised_rows,
    )
