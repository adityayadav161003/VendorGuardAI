from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api import api_router

# Initialize database tables on startup
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS setup for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            "suppliers": f"{settings.API_V1_STR}/suppliers",
            "claims": f"{settings.API_V1_STR}/claims",
            "chat": f"{settings.API_V1_STR}/chat",
            "docs": "/docs"
        }
    }

# Healthcheck ping
# CORS middleware allowed origins
