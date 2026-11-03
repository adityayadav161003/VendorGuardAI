import os
from pathlib import Path
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "VendorGuard AI"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    DESCRIPTION: str = "Evidence-Grounded Supplier Verification & Predictive Risk Intelligence Engine"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    UPLOADS_DIR: Path = DATA_DIR / "uploads"
    FIXTURES_DIR: Path = DATA_DIR / "fixtures"
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/vendorguard.db")
    
    # Model & Risk Thresholds
    RISK_THRESHOLD_HIGH: float = 75.0
    RISK_THRESHOLD_MEDIUM: float = 50.0
    CLAIM_NLI_CONFIDENCE_THRESHOLD: float = 0.70

    def init_directories(self):
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        self.FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
settings.init_directories()

# Configuration loader
# Default host and port
