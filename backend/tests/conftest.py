import os
import sys
import tempfile

# Isolate the test suite from the development database before app import
_TEST_DB = os.path.join(tempfile.gettempdir(), "vendorguard_test.db")
if os.path.exists(_TEST_DB):
    os.remove(_TEST_DB)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEST_PASSWORD = "TestPass@123"


def _ensure_user(email: str, role: str):
    from app.core.database import SessionLocal
    from app.core.security import hash_password
    from app.models.entities import User

    import app.main  # noqa: F401  (triggers init_db so tables exist before seeding)
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            name=f"{role} Tester",
            email=email,
            role=role,
            organization="TestOrg",
            password_hash=hash_password(TEST_PASSWORD),
        )
        db.add(user)
        db.commit()
    db.close()


_ensure_user("proc@test.local", "procurement_officer")
_ensure_user("reviewer@test.local", "reviewer")
_ensure_user("admin@test.local", "admin")


def client_for(email: str):
    """TestClient pre-authenticated for the given seeded user."""
    from fastapi.testclient import TestClient
    from app.main import app

    c = TestClient(app)
    res = c.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert res.status_code == 200, res.text
    c.headers.update({"Authorization": f"Bearer {res.json()['access_token']}"})
    return c


def anon_client():
    from fastapi.testclient import TestClient
    from app.main import app

    return TestClient(app)


# Shared authenticated clients (procurement = least privilege)
client = client_for("proc@test.local")
reviewer_client = client_for("reviewer@test.local")
admin_client = client_for("admin@test.local")
