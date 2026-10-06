from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.api import api_router
from app.api.auth import seed_admin_user

# Initialize database tables and the bootstrap admin on startup
init_db()
with SessionLocal() as _startup_db:
    seed_admin_user(_startup_db)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS: explicit allow-list only. '*' together with credentials is invalid per
# the fetch spec and would let any site make credentialed calls.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

from app.core.middleware import RequestIDMiddleware

app.add_middleware(RequestIDMiddleware)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response

# Mount all domain routers under /api
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API. Visit /docs for OpenAPI documentation.",
        "version": settings.VERSION,
        "endpoints": {
            "auth": f"{settings.API_V1_STR}/auth/login",
            "suppliers": f"{settings.API_V1_STR}/suppliers",
            "claims": f"{settings.API_V1_STR}/claims",
            "chat": f"{settings.API_V1_STR}/chat",
            "docs": "/docs"
        }
    }
