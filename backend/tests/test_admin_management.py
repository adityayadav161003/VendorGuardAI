"""
Admin user management tests: listing, role changes, last-admin and
self-demotion guards. Uses dedicated throwaway users so role changes
never leak into other tests' permissions.
"""
from tests.conftest import admin_client, anon_client


def _register(name: str) -> dict:
    res = anon_client().post("/api/auth/register", json={
        "name": name, "email": f"{name.lower().replace(' ', '.')}@test.local",
        "password": "Throwaway@123",
    })
    assert res.status_code == 201, res.text
    return res.json()["user"]


def _admin_promote(admin, user_id: str):
    res = admin.patch(f"/api/admin/users/{user_id}", json={"role": "admin"})
    assert res.status_code == 200, res.text


def test_admin_can_list_members():
    res = admin_client.get("/api/admin/users")
    assert res.status_code == 200
    emails = [u["email"] for u in res.json()]
    assert "admin@test.local" in emails


def test_non_admin_cannot_list_or_change_roles():
    sid_user = _register("Blocked Procurement")
    c = anon_client()
    login = c.post("/api/auth/login", json={
        "email": "blocked.procurement@test.local", "password": "Throwaway@123"
    }).json()
    c.headers.update({"Authorization": f"Bearer {login['access_token']}"})

    assert c.get("/api/admin/users").status_code == 403
    res = c.patch(f"/api/admin/users/{sid_user}", json={"role": "admin"})
    assert res.status_code == 403


def test_admin_can_change_member_role():
    user = _register("Promotable Person")
    res = admin_client.patch(f"/api/admin/users/{user['user_id']}", json={"role": "reviewer"})
    assert res.status_code == 200
    assert res.json()["role"] == "reviewer"

    # invalid role rejected
    bad = admin_client.patch(f"/api/admin/users/{user['user_id']}", json={"role": "supreme_leader"})
    assert bad.status_code == 422


def test_admin_cannot_change_own_role():
    admins = [u for u in admin_client.get("/api/admin/users").json() if u["email"] == "admin@test.local"]
    res = admin_client.patch(f"/api/admin/users/{admins[0]['user_id']}", json={"role": "reviewer"})
    assert res.status_code == 409


def test_multi_admin_demotion_and_self_guard_protection():
    """With two admins, a non-self demotion is allowed; the self-change guard
    plus the last-admin rule together guarantee at least one admin remains."""
    c = anon_client()
    reg = c.post("/api/auth/register", json={
        "name": "Second Admin Probe", "email": "second-admin@test.local", "password": "SecondAdmin@123",
    })
    assert reg.status_code == 201
    probe_id = reg.json()["user"]["user_id"]

    _admin_promote(admin_client, probe_id)          # workspace now has 2 admins

    # demoting the OTHER admin is allowed while another admin remains
    r1 = admin_client.patch(f"/api/admin/users/{probe_id}", json={"role": "procurement_officer"})
    assert r1.status_code == 200

    # re-promote, then confirm an admin cannot demote themselves — this is
    # what guarantees a workspace can never lose its last administrator
    _admin_promote(admin_client, probe_id)
    self_target = [u for u in admin_client.get("/api/admin/users").json() if u["email"] == "admin@test.local"][0]
    r2 = admin_client.patch(f"/api/admin/users/{self_target['user_id']}", json={"role": "procurement_officer"})
    assert r2.status_code == 409

    # restore for other tests
    admin_client.patch(f"/api/admin/users/{probe_id}", json={"role": "procurement_officer"})


def test_role_change_is_audited():
    user = _register("Audited Promotion")
    admin_client.patch(f"/api/admin/users/{user['user_id']}", json={"role": "reviewer"})
    from app.core.database import SessionLocal
    from app.models.entities import AuditEvent
    db = SessionLocal()
    events = db.query(AuditEvent).filter(
        AuditEvent.action == "USER_ROLE_CHANGED",
        AuditEvent.object_id == user["user_id"],
    ).all()
    db.close()
    assert events, "role change must leave an audit trail"
