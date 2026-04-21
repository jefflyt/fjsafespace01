"""
backend/app/services/csv_parser.py

CSV parsing and validation service for uHoo IAQ data exports.

Reference format (NPE table header — canonical):
  device_id, timestamp, zone_name, co2_ppm, pm2_5_ugm3, tvoc_ppb,
  temperature_c, humidity_rh

Also supports alternate uHoo export headers via COLUMN_ALIASES.

Reference: TDD §4.1 (POST /api/uploads processing)
"""

from dataclasses import dataclass, field
from typing import IO

import pandas as pd

from app.models.enums import ParseOutcome, ReportType


# Standard column names — metadata (required) + sensor metrics (optional, parsed if present)
METADATA_COLUMNS = {"device_id", "timestamp", "zone_name"}

SENSOR_COLUMNS = {
    "co2_ppm", "co_ppb", "pm2_5_ugm3", "humidity_rh", "temperature_c",
    "tvoc_ppb", "o3_ppb", "no_ppb", "no2_ppb", "voc_ppb",
    "pressure_hpa", "noise_dba", "pm10_ugm3", "aqi_index",
}

# Map alternate uHoo export headers to standard column names
COLUMN_ALIASES = {
    # Metadata
    "Sampling Location": "zone_name",
    "Date and Time": "timestamp",
    # Sensor metrics
    "CO2": "co2_ppm",
    "CO": "co_ppb",
    "PM2.5": "pm2_5_ugm3",
    "Humidity": "humidity_rh",
    "Relative Humidity": "humidity_rh",
    "Temperature": "temperature_c",
    "TVOC": "tvoc_ppb",
    "O3": "o3_ppb",
    "Ozone": "o3_ppb",
    "NO": "no_ppb",
    "NO2": "no2_ppb",
    "VOC": "voc_ppb",
    "PRS": "pressure_hpa",
    "Air Pressure": "pressure_hpa",
    "Noise Level": "noise_dba",
    "Noise_Level": "noise_dba",
    "Sound": "noise_dba",
    "PM10": "pm10_ugm3",
    "Air Quality Index": "aqi_index",
    "AQI": "aqi_index",
}

# Outlier detection thresholds — physically plausible bounds per metric
OUTLIER_BOUNDS = {
    "co2_ppm": {"min": 300, "max": 5000},
    "co_ppb": {"min": 0, "max": 1000},
    "pm2_5_ugm3": {"min": 0, "max": 500},
    "humidity_rh": {"min": 0, "max": 100},
    "temperature_c": {"min": -10, "max": 60},
    "tvoc_ppb": {"min": 0, "max": 2000},
    "o3_ppb": {"min": 0, "max": 300},
    "no_ppb": {"min": 0, "max": 500},
    "no2_ppb": {"min": 0, "max": 500},
    "voc_ppb": {"min": 0, "max": 2000},
    "pressure_hpa": {"min": 870, "max": 1085},
    "noise_dba": {"min": 0, "max": 140},
    "pm10_ugm3": {"min": 0, "max": 600},
    "aqi_index": {"min": 0, "max": 500},
}

# Map CSV column names to metric enum names and units (all 16 uHoo sensor metrics)
METRIC_MAP = [
    ("co2_ppm", "co2_ppm", "ppm"),
    ("co_ppb", "co_ppb", "ppb"),
    ("pm2_5_ugm3", "pm25_ugm3", "μg/m³"),
    ("humidity_rh", "humidity_rh", "%RH"),
    ("temperature_c", "temperature_c", "°C"),
    ("tvoc_ppb", "tvoc_ppb", "ppb"),
    ("o3_ppb", "o3_ppb", "ppb"),
    ("no_ppb", "no_ppb", "ppb"),
    ("no2_ppb", "no2_ppb", "ppb"),
    ("voc_ppb", "voc_ppb", "ppb"),
    ("pressure_hpa", "pressure_hpa", "hPa"),
    ("noise_dba", "noise_dba", "dBA"),
    ("pm10_ugm3", "pm10_ugm3", "μg/m³"),
    ("aqi_index", "aqi_index", "AQI"),
]

# Sensor metric columns that should be filled with 0 when data is missing
FILL_COLUMNS = SENSOR_COLUMNS


def detect_report_type(df: pd.DataFrame) -> ReportType:
    """
    Auto-detect report type from CSV timestamp patterns.
    - Single calendar day → ASSESSMENT
    - Multiple calendar days → INTERVENTION_IMPACT
    """
    if "timestamp" not in df.columns:
        return ReportType.ASSESSMENT

    try:
        timestamps = pd.to_datetime(df["timestamp"], utc=True)
        unique_dates = timestamps.dt.date.nunique()
        return ReportType.INTERVENTION_IMPACT if unique_dates > 1 else ReportType.ASSESSMENT
    except Exception:
        return ReportType.ASSESSMENT


@dataclass
class ParseResult:
    parse_outcome: ParseOutcome
    warnings: list[str] = field(default_factory=list)
    failed_row_count: int = 0
    normalised_rows: list[dict] = field(default_factory=list)
    report_type: ReportType = ReportType.ASSESSMENT


def parse_csv(file: IO[bytes], site_id: str, upload_id: str) -> ParseResult:
    """
    Parse a uHoo CSV export and return a ParseResult.

    - Reads file into pandas DataFrame
    - Normalizes column headers (supports alternate uHoo formats)
    - Fills missing metric data with 0 instead of failing rows
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
            report_type=ReportType.ASSESSMENT,
        )

    # Normalize column headers: map alternate uHoo headers to standard names
    df.rename(columns=COLUMN_ALIASES, inplace=True)

    # Handle missing device_id: derive from zone_name if absent
    if "device_id" not in df.columns:
        df["device_id"] = df["zone_name"] if "zone_name" in df.columns else "unknown"

    # Fill missing metric data with 0 (user requirement: no data → "0")
    for col in FILL_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Detect report type from timestamp patterns
    report_type = detect_report_type(df)

    # Validate required metadata columns + at least one sensor column
    missing_meta = METADATA_COLUMNS - set(df.columns)
    if missing_meta:
        return ParseResult(
            parse_outcome=ParseOutcome.FAIL,
            warnings=[f"Missing required columns: {', '.join(sorted(missing_meta))}"],
            failed_row_count=0,
            normalised_rows=[],
        )
    present_sensors = SENSOR_COLUMNS & set(df.columns)
    if not present_sensors:
        return ParseResult(
            parse_outcome=ParseOutcome.FAIL,
            warnings=["No recognized sensor columns found in CSV"],
            failed_row_count=0,
            normalised_rows=[],
        )

    # Parse timestamps (handles both ISO 8601 and UK DD/MM/YY formats)
    try:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, dayfirst=True)
    except Exception as e:
        warnings.append(f"Timestamp parsing failed for some rows: {str(e)}")

    # Only process sensor columns present in the CSV
    present_sensors = SENSOR_COLUMNS & set(df.columns)
    active_metrics = [(c, m, u) for c, m, u in METRIC_MAP if c in present_sensors]

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
        for csv_col, metric_name, unit in active_metrics:
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
        report_type=report_type,
    )
