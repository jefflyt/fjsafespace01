"""
backend/app/api/routers/uploads.py

Upload routes — Workflow B entry point.

POST /api/uploads
    Accepts a CSV file + siteId.  Synchronously: parse → validate →
    normalise → rule evaluate → write findings to DB.
    Returns upload summary with findingCount and any warnings.

GET /api/uploads/{upload_id}
    Returns upload metadata and parse status.

GET /api/uploads/{upload_id}/findings
    Returns all findings for an upload.
    Returns 422 if any finding is missing rule_version or citation_unit_ids
    (enforces QA-G5 / Differentiation Requirement D1).

Reference: TDD §4.1
"""

from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlmodel import select

from app.api.dependencies import SessionDep

router = APIRouter()


@router.post("/uploads", status_code=status.HTTP_200_OK)
async def create_upload(
    session: SessionDep,
    file: UploadFile,
    site_id: str,
    context: str | None = None,
):
    """
    Accept a CSV export from uHoo, parse, validate, evaluate against the
    active Rulebook version, store findings, and return the upload summary.

    TODO (Phase 1 implementation):
    - Validate file is CSV with expected schema columns
    - Call csv_parser.parse() → normalised readings
    - Call rule_engine.evaluate() → findings
    - Persist Upload + Reading + Finding records
    - Return { uploadId, parseStatus, parseOutcome, warnings, findingCount, failedRowCount }
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/uploads/{upload_id}", status_code=status.HTTP_200_OK)
async def get_upload(upload_id: str, session: SessionDep):
    """
    Return upload metadata: parseStatus, parseOutcome, warnings, uploadedAt, fileName.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")


@router.get("/uploads/{upload_id}/findings", status_code=status.HTTP_200_OK)
async def get_findings(upload_id: str, session: SessionDep):
    """
    Return all findings for an upload.
    Enforces QA-G5: returns 422 if any finding is missing ruleVersion or citationUnitIds.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not yet implemented")
