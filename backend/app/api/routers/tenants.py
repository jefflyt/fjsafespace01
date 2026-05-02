"""
backend/app/api/routers/tenants.py

Tenant/customer management endpoints for adhoc customer intake.

GET  /api/tenants/search?q=<text>  — debounced search across client_name, contact_person, site_address
GET  /api/tenants                  — list all tenants with scan counts
GET  /api/tenants/{tenant_id}      — tenant details + upload history
POST /api/tenants                  — create new tenant
PATCH /api/tenants/{tenant_id}     — update tenant fields
"""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import select, func, text

from app.api.dependencies import SessionDep
from app.models.supporting import Tenant
from app.models.workflow_b import Upload, Site
from app.schemas.tenant import (
    TenantCreate,
    TenantDetail,
    TenantSearchResult,
    TenantSummary,
    TenantUpdate,
)

router = APIRouter()


@router.get("/tenants/search", status_code=status.HTTP_200_OK)
def search_tenants(
    session: SessionDep,
    q: str = Query(..., min_length=1, description="Search query"),
):
    """
    Search tenants by client_name, contact_person, or site_address.
    Returns top 10 matches sorted by relevance.
    """
    if len(q.strip()) < 2:
        return []

    search_term = f"%{q.strip().lower()}%"

    # Search across three fields using raw SQL for ILIKE
    results = session.execute(
        text("""
            SELECT id, client_name, site_address, contact_person, contact_email,
                   CASE
                       WHEN LOWER(client_name) LIKE :term THEN 3
                       WHEN LOWER(contact_person) LIKE :term THEN 2
                       WHEN LOWER(site_address) LIKE :term THEN 1
                       ELSE 0
                   END as match_score
            FROM tenant
            WHERE LOWER(client_name) LIKE :term
               OR LOWER(contact_person) LIKE :term
               OR LOWER(site_address) LIKE :term
            ORDER BY match_score DESC, created_at DESC
            LIMIT 10
        """),
        {"term": search_term},
    ).all()

    return [
        TenantSearchResult(
            id=str(row[0]),
            client_name=row[1] or "",
            site_address=row[2],
            contact_person=row[3],
            contact_email=row[4] or "",
            match_score=float(row[5]),
        )
        for row in results
        if row[5] > 0
    ]


@router.get("/tenants", status_code=status.HTTP_200_OK)
def list_tenants(session: SessionDep):
    """List all tenants with scan counts."""
    tenants = session.exec(select(Tenant).order_by(Tenant.created_at.desc())).all()

    summaries = []
    for tenant in tenants:
        # Count scans (uploads linked to sites belonging to this tenant)
        scan_count = session.exec(
            select(func.count(Upload.id))
            .join(Site, Upload.site_id == Site.id)
            .where(Site.tenant_id == tenant.id)
        ).one()

        # Count sites
        site_count = session.exec(
            select(func.count(Site.id))
            .where(Site.tenant_id == tenant.id)
        ).one()

        summaries.append(
            TenantSummary(
                id=str(tenant.id),
                client_name=tenant.client_name or "",
                site_address=tenant.site_address,
                contact_person=tenant.contact_person,
                contact_email=tenant.contact_email or "",
                scan_count=scan_count or 0,
                site_count=site_count or 0,
                created_at=tenant.created_at.isoformat(),
            )
        )

    return summaries


@router.get("/tenants/{tenant_id}", status_code=status.HTTP_200_OK)
def get_tenant(tenant_id: str, session: SessionDep):
    """Get tenant details with upload history."""
    tenant = session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    # Get upload history (last 10)
    uploads = session.exec(
        select(Upload)
        .join(Site, Upload.site_id == Site.id)
        .where(Site.tenant_id == tenant_id)
        .order_by(Upload.uploaded_at.desc())
        .limit(10)
    ).all()

    # Count totals
    scan_count = session.exec(
        select(func.count(Upload.id))
        .join(Site, Upload.site_id == Site.id)
        .where(Site.tenant_id == tenant_id)
    ).one()

    site_count = session.exec(
        select(func.count(Site.id))
        .where(Site.tenant_id == tenant_id)
    ).one()

    return TenantDetail(
        id=str(tenant.id),
        client_name=tenant.client_name or "",
        site_address=tenant.site_address,
        contact_person=tenant.contact_person,
        contact_email=tenant.contact_email or "",
        premises_type=tenant.premises_type,
        specific_event=tenant.specific_event,
        comparative_analysis=tenant.comparative_analysis,
        scan_count=scan_count or 0,
        site_count=site_count or 0,
        created_at=tenant.created_at.isoformat(),
        uploads=[
            {
                "id": str(u.id),
                "file_name": u.file_name,
                "uploaded_at": u.uploaded_at.isoformat(),
                "parse_status": u.parse_status.value if u.parse_status else None,
            }
            for u in uploads
        ],
    )


@router.post("/tenants", status_code=status.HTTP_201_CREATED)
def create_tenant(body: TenantCreate, session: SessionDep):
    """Create a new tenant with minimal fields."""
    # Check for duplicate email
    existing = session.exec(
        select(Tenant).where(Tenant.contact_email == body.contact_email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A customer with this email already exists",
        )

    tenant = Tenant(
        id=str(uuid.uuid4()),
        client_name=body.client_name,
        contact_email=body.contact_email,
        contact_person=body.contact_person,
        site_address=body.site_address,
        premises_type=body.premises_type,
        tenant_name=body.client_name,
    )
    session.add(tenant)
    session.commit()
    session.refresh(tenant)

    return {
        "id": str(tenant.id),
        "client_name": tenant.client_name,
        "contact_email": tenant.contact_email,
    }


@router.patch("/tenants/{tenant_id}", status_code=status.HTTP_200_OK)
def update_tenant(tenant_id: str, body: TenantUpdate, session: SessionDep):
    """Update tenant fields — all optional."""
    tenant = session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    # Check email uniqueness if changing
    if body.contact_email and body.contact_email != tenant.contact_email:
        existing = session.exec(
            select(Tenant).where(
                Tenant.contact_email == body.contact_email,
                Tenant.id != tenant_id,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A customer with this email already exists",
            )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    session.add(tenant)
    session.commit()
    session.refresh(tenant)

    return {
        "id": str(tenant.id),
        "client_name": tenant.client_name,
        "contact_email": tenant.contact_email,
    }
