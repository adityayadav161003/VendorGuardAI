from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.suppliers import router as suppliers_router
from app.api.documents import router as documents_router
from app.api.analysis import router as analysis_router
from app.api.graph import router as graph_router
from app.api.claims import router as claims_router
from app.api.chat import router as chat_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(suppliers_router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(documents_router, prefix="/suppliers", tags=["Documents"])
api_router.include_router(analysis_router, prefix="/suppliers", tags=["Analysis & Risk"])
api_router.include_router(graph_router, prefix="/suppliers", tags=["Knowledge Graph"])
api_router.include_router(claims_router, prefix="/claims", tags=["Claim Verification"])
api_router.include_router(chat_router, prefix="/chat", tags=["AI Analyst Chat"])
