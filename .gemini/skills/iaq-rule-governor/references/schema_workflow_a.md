# Workflow A Schema Reference

## ReferenceSource
Table for raw standards, guidelines, and whitepapers.

| Field | Type | Description |
|---|---|---|
| `id` | UUID (str) | Unique identifier |
| `title` | str | Document title |
| `publisher` | str | Issuing body (e.g., WHO, BCA) |
| `source_type` | str | `standard`, `guideline`, `whitepaper`, `vendor` |
| `jurisdiction` | str | SG, Global, etc. |
| `status` | str | `active`, `superseded`, `retired` |
| `source_currency_status` | Enum | `CURRENT_VERIFIED`, `PARTIAL_EXTRACT`, `VERSION_UNVERIFIED`, `SUPERSEDED` |

## CitationUnit
Extracted verbatim excerpts from a `ReferenceSource`.

| Field | Type | Description |
|---|---|---|
| `source_id` | UUID (str) | Foreign key to `ReferenceSource` |
| `exact_excerpt` | str | Verbatim text from source |
| `metric_tags` | JSON str[] | e.g., `["co2_ppm"]` |
| `condition_tags` | JSON str[] | e.g., `["office", "occupied"]` |
| `needs_review` | bool | Default `True` |

## RulebookEntry
The runtime source of truth for threshold evaluation.

| Field | Type | Description |
|---|---|---|
| `metric_name` | Enum | `co2_ppm`, `pm25_ugm3`, `tvoc_ppb`, `temperature_c`, `humidity_rh` |
| `threshold_type` | str | `range`, `upper_bound`, `lower_bound` |
| `min_value` | float? | |
| `max_value` | float? | |
| `context_scope` | str | `office`, `industrial`, `school`, `residential`, `general` |
| `index_weight_percent`| float? | e.g., 25.0 for CO2 |
| `priority_logic` | Enum | `P1`, `P2`, `P3` |
| `rule_version` | str | Semver (e.g., `1.0.0`) |
| `approval_status` | str | `draft`, `approved`, `superseded` |
