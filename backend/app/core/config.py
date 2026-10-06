import os
import secrets
from pathlib import Path
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "VendorGuard AI"
    VERSION: str = "0.2.0"
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
    CLAIM_NLI_CONFIDENCE_THRESHOLD: float = 0.80
    RULE_VERSION: str = "v2.0.0-trust-core"
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("1", "true", "yes")

    # --- Security & access control ---
    # JWT signing secret: MUST be provided via JWT_SECRET in any real deployment.
    # A random secret is generated per-process when unset (tokens survive only
    # within one server run; nothing predictable is ever committed to the repo).
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

    # Seeded bootstrap admin (change these via env before any shared deployment)
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@vendorguard.local")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@12345")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "System Administrator")

    # Login brute-force protection: max failed attempts per (ip, email) window
    LOGIN_MAX_ATTEMPTS: int = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
    LOGIN_LOCKOUT_SECONDS: int = int(os.getenv("LOGIN_LOCKOUT_SECONDS", "900"))

    # CORS: explicit origins only (never '*' together with credentials)
    CORS_ORIGINS: list = [
        o.strip() for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",") if o.strip()
    ]

    # Upload safety limits
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    MAX_PDF_PAGES: int = 50

    def init_directories(self):
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        self.FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()

# Generate the fallback secret exactly once per process so tokens created and
# verified within the same run share one key.
if not settings.JWT_SECRET:
    settings.JWT_SECRET = secrets.token_hex(32)

settings.init_directories()

if not os.getenv("JWT_SECRET"):
    print(
        "[VendorGuard] WARNING: JWT_SECRET is not configured — a random secret was "
        "generated for this process only. All sessions invalidate on restart. "
        "Set JWT_SECRET in your environment for stable sessions."
    )
