from fastapi import FastAPI

from app.api.errors import register_exception_handlers
from app.api.routes.auth import router as auth_router
from app.api.routes.complaints import router as complaints_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="GrievX Campus backend API.",
)

register_exception_handlers(app)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(complaints_router)


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "ok",
    }
