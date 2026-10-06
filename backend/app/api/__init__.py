from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.suppliers import router as suppliers_router
from app.api.documents import router as documents_router
from app.api.analysis import router as analysis_router
from app.api.graph import router as graph_router
from app.api.claims import router as claims_router
from app.api.chat import router as chat_router
from app.api.tenders import router as tenders_router
from app.api.analytics import router as analytics_router
from app.api.pipeline import router as pipeline_router
from app.api.portal import router as portal_router
from app.api.monitoring import router as monitoring_router
from app.api.policies import router as policies_router
from app.api.integrations import router as integrations_router
from app.api.evaluation import router as eval_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(suppliers_router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(documents_router, prefix="/suppliers", tags=["Documents"])
api_router.include_router(analysis_router, prefix="/suppliers", tags=["Analysis & Risk"])
api_router.include_router(graph_router, prefix="/suppliers", tags=["Knowledge Graph"])
api_router.include_router(claims_router, prefix="/claims", tags=["Claim Verification"])
api_router.include_router(chat_router, prefix="/chat", tags=["AI Analyst Chat"])
api_router.include_router(tenders_router, prefix="/tenders", tags=["Tender Award Engine"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Executive Analytics"])
api_router.include_router(pipeline_router, prefix="/pipeline", tags=["Async Verification Pipeline"])
api_router.include_router(portal_router, tags=["Supplier Portal"])
api_router.include_router(monitoring_router, prefix="/monitoring", tags=["Continuous Monitoring & Alerts"])
api_router.include_router(policies_router, prefix="/policies", tags=["Approval Governance & Policies"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["Integrations & Webhooks"])
api_router.include_router(eval_router, prefix="/eval", tags=["Automated Benchmarks & Evaluation"])
