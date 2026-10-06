from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# SQLite configuration (check_same_thread=False allows FastAPI multi-threading)
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    # Lightweight schema upgrade for SQLite
    if "sqlite" in settings.DATABASE_URL:
        import sqlite3
        db_path = settings.DATABASE_URL.replace("sqlite:///", "")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(analysis_results)")
            existing_cols = {row[1] for row in cursor.fetchall()}
            new_cols = [
                ("assessment_state", "VARCHAR(30) DEFAULT 'ASSESSED'"),
                ("evidence_coverage", "FLOAT DEFAULT 0.0"),
                ("assessment_confidence", "FLOAT DEFAULT 0.0"),
                ("provisional_reason", "TEXT"),
                ("rule_version", "VARCHAR(50) DEFAULT 'v2.0.0-trust-core'"),
                ("is_evidence_grounded", "INTEGER DEFAULT 0"),
                ("system_notices", "JSON DEFAULT '[]'"),
            ]
            for col_name, col_type in new_cols:
                if col_name not in existing_cols:
                    cursor.execute(f"ALTER TABLE analysis_results ADD COLUMN {col_name} {col_type}")

            cursor.execute("PRAGMA table_info(claims)")
            existing_claim_cols = {row[1] for row in cursor.fetchall()}
            if "model_version" not in existing_claim_cols:
                cursor.execute("ALTER TABLE claims ADD COLUMN model_version VARCHAR(50) DEFAULT 'v2.0.0-trust-core'")

            conn.commit()
            conn.close()
        except Exception:
            pass
