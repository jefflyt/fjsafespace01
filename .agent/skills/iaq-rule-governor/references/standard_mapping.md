# IAQ Standard Mapping Reference

Common standards and their typical metric mappings for FJ SafeSpace.

| Standard | Publisher | Metric | Typical Threshold | Unit | Priority |
|---|---|---|---|---|---|
| WHO 2021 | WHO | `pm25_ugm3` | 15 (24-hour mean) | ug/m3 | P1 |
| SS 554 | Enterprise SG | `co2_ppm` | 700 above outdoor | ppm | P2 |
| BCA Green Mark | BCA | `tvoc_ppb` | 300 (TVOC) | ppb | P1 |
| WELL v2 | IWBI | `humidity_rh` | 30 - 60 | % | P3 |

## Metric Name Enums
- `co2_ppm`
- `pm25_ugm3`
- `tvoc_ppb`
- `temperature_c`
- `humidity_rh`

## Priority Enums
- `P1`: Critical (Health/Compliance)
- `P2`: Watch (Comfort/Warning)
- `P3`: Advisory (Optimisation)

## Source Currency
- `CURRENT_VERIFIED`: Latest pinned version
- `PARTIAL_EXTRACT`: Not all clauses ingested
- `VERSION_UNVERIFIED`: Version not yet cross-checked
- `SUPERSEDED`: Obsolete standard
