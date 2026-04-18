from app.api.routers.dashboard import router as dashboard_router
from app.api.routers.notifications import router as notifications_router
from app.api.routers.reports import router as reports_router
from app.api.routers.rulebook import router as rulebook_router
from app.api.routers.uploads import router as uploads_router

__all__ = ["dashboard_router", "notifications_router", "reports_router", "rulebook_router", "uploads_router"]
