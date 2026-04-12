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


@dataclass
class ParseResult:
    parse_outcome: ParseOutcome
    warnings: list[str] = field(default_factory=list)
    failed_row_count: int = 0
    normalised_rows: list[dict] = field(default_factory=list)


def parse_csv(file: IO[bytes], site_id: str, upload_id: str) -> ParseResult:
    """
    Parse a uHoo CSV export and return a ParseResult.

    TODO (Phase 1 implementation):
    - Read file into pandas DataFrame
    - Validate required columns present → FAIL if missing
    - Parse timestamp to datetime
    - Detect outliers (e.g. CO2 > 5000 ppm, negative values)
    - Build normalised_rows list (one dict per metric per row)
    - Set ParseOutcome based on warning count and failed rows
    """
    raise NotImplementedError("csv_parser.parse_csv — Phase 1 implementation pending")
