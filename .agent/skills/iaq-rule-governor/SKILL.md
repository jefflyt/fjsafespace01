---
name: iaq-rule-governor
description: Manages Workflow A (Standards Governance) for FJ SafeSpace. Use when Gemini CLI needs to ingest new standards, extract citations, or update the Rulebook.
---

# IAQ Rule Governor

This skill governs the integrity of the **Workflow A** pipeline: Reference Vault → Citation Units → Rulebook.

## Workflows

### 1. Ingesting a New Standard
When a new standard (e.g., WHO, BCA) is introduced:
1.  **Register Source:** Create a `ReferenceSource` record with appropriate `source_currency_status`.
2.  **Extract Citations:** Create `CitationUnit` records for specific clauses, ensuring verbatim `exact_excerpt` is captured.
3.  **Propose Rules:** Draft `RulebookEntry` records linked to the new citations.

### 2. Updating Thresholds
To update a threshold:
1.  Locate the existing `RulebookEntry`.
2.  Mark the old entry as `superseded` and set `effective_to`.
3.  Create a new `RulebookEntry` with the updated values and increment the `rule_version`.

## Governance Guardrails
- **Read-Only Access:** Most services use `DATABASE_URL` (SELECT-only). Rule changes MUST use `ADMIN_DATABASE_URL`.
- **Traceability:** No rule can be approved without at least one linked `CitationUnit`.
- **Source Currency:** Only `CURRENT_VERIFIED` sources can drive certification-impact rules. Others are marked "Advisory Only".

## Resources
- **Schema:** See `references/schema_workflow_a.md` for table definitions.
- **Mapping:** See `references/standard_mapping.md` for metric and priority definitions.

## Database Interaction
Use the `backend/app/models/workflow_a.py` models with a `Session` from `backend/app/database.py`. 

**Example (Ingest Source):**
```python
from app.database import engine
from app.models.workflow_a import ReferenceSource
from app.models.enums import SourceCurrency
from sqlmodel import Session

with Session(engine) as session:
    source = ReferenceSource(
        title="WHO Air Quality Guidelines 2021",
        publisher="WHO",
        source_type="guideline",
        jurisdiction="Global",
        status="active",
        source_currency_status=SourceCurrency.CURRENT_VERIFIED
    )
    session.add(source)
    session.commit()
```
