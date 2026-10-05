"""
Security & honesty regression tests:
authentication, RBAC, brute-force lockout, upload hardening, XSS escaping,
and the unreadable-upload scoring fix (random image must NOT score LOW risk).
"""
import io
import struct
import zlib

from tests.conftest import client, reviewer_client, anon_client, client_for, TEST_PASSWORD


# ------------------------------------------------------------------ helpers

def _create_supplier(name: str) -> str:
    res = client.post("/api/suppliers", json={"name": name})
    assert res.status_code == 201
    return res.json()["supplier_id"]


def _png_bytes(width_px: int = 8, height_px: int = 8) -> bytes:
    """Minimal valid PNG with random-looking pixels (no readable text)."""
    def chunk(ctype: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + ctype + data
        return c + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width_px, height_px, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + bytes((x * 37 + y * 11) % 256 for x in range(width_px * 3))
                   for y in range(height_px))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))


# ------------------------------------------------------------------ auth

def test_protected_endpoints_reject_anonymous_requests():
    c = anon_client()
    for method, path in [
        ("get", "/api/suppliers"),
        ("post", "/api/suppliers"),
        ("post", "/api/suppliers/some-id/analyze"),
        ("get", "/api/suppliers/some-id/report"),
        ("get", "/api/suppliers/some-id/alerts"),
        ("get", "/api/suppliers/some-id/graph"),
        ("get", "/api/suppliers/some-id/report/export?format=json"),
        ("post", "/api/chat"),
        ("post", "/api/claims/verify"),
    ]:
        kwargs = {"json": {}} if method == "post" else {}
        res = getattr(c, method)(path, **kwargs)
        assert res.status_code == 401, f"{method.upper()} {path} -> {res.status_code}"


def test_register_login_me_roundtrip():
    c = anon_client()
    reg = c.post("/api/auth/register", json={
        "name": "Round Trip", "email": "roundtrip@test.local",
        "password": "RoundTrip@123", "organization": "RT Org",
    })
    assert reg.status_code == 201
    body = reg.json()
    assert body["user"]["role"] == "procurement_officer"  # least privilege by default

    me = c.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "roundtrip@test.local"

    # Fresh login also works
    login = anon_client().post("/api/auth/login", json={
        "email": "roundtrip@test.local", "password": "RoundTrip@123"
    })
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_login_fails_uniformly_for_wrong_password_and_unknown_email():
    for email in ["proc@test.local", "ghost@test.local"]:
        res = anon_client().post("/api/auth/login", json={
            "email": email, "password": "DefinitelyWrong@1"
        })
        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid email or password."


def test_login_locks_after_repeated_failures():
    c = anon_client()
    for _ in range(5):
        res = c.post("/api/auth/login", json={
            "email": "lockout@test.local", "password": "WrongPass@111"
        })
        assert res.status_code == 401
    res = c.post("/api/auth/login", json={
        "email": "lockout@test.local", "password": "WrongPass@111"
    })
    assert res.status_code == 429
    assert "Too many failed attempts" in res.json()["detail"]


def test_registration_validates_input():
    c = anon_client()
    weak = c.post("/api/auth/register", json={
        "name": "Weak", "email": "weak@test.local", "password": "short"
    })
    assert weak.status_code == 422

    bad_email = c.post("/api/auth/register", json={
        "name": "Bad", "email": "not-an-email", "password": "GoodPass@123"
    })
    assert bad_email.status_code == 422

    dup = c.post("/api/auth/register", json={
        "name": "Dup", "email": "proc@test.local", "password": "GoodPass@123"
    })
    assert dup.status_code == 409


def test_rbac_role_gates():
    sid = _create_supplier("RBAC Target Pvt Ltd")

    # procurement cannot change review status or record claim decisions
    assert client.patch(f"/api/suppliers/{sid}", json={"status": "VERIFIED"}).status_code == 403

    # reviewer can
    ok = reviewer_client.patch(f"/api/suppliers/{sid}", json={"status": "VERIFIED"})
    assert ok.status_code == 200
    assert ok.json()["status"] == "VERIFIED"

    # tampered JWT is rejected
    tampered = client.headers["Authorization"].replace(".", ".x", 1) \
        if client.headers.get("Authorization") else "Bearer tampered.token.value"
    res = anon_client().get("/api/suppliers", headers={"Authorization": tampered})
    assert res.status_code == 401


def test_seeded_admin_can_login():
    res = client_for("admin@test.local")  # asserts login inside
    assert res.headers.get("authorization", "").startswith("Bearer ")


# ------------------------------------------------------------------ upload hardening

def test_disguised_file_rejected_by_magic_bytes():
    sid = _create_supplier("Magic Byte Guard Pvt Ltd")
    res = client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("payload.png", io.BytesIO(b"MZ\x90\x00 fake executable"), "application/octet-stream")},
        data={"document_type": "OTHER"},
    )
    assert res.status_code == 400
    assert "does not match its extension" in res.json()["detail"]


def test_oversized_upload_rejected():
    sid = _create_supplier("Size Guard Pvt Ltd")
    big = b"%PDF-1.4\n" + b"A" * (10 * 1024 * 1024 + 100)
    res = client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("big.pdf", io.BytesIO(big), "application/pdf")},
        data={"document_type": "OTHER"},
    )
    assert res.status_code == 413


def test_duplicate_upload_rejected():
    sid = _create_supplier("Dedupe Guard Pvt Ltd")
    content = "Company Name: Dedupe Guard Pvt Ltd\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n"
    first = client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("cert.txt", io.BytesIO(content.encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )
    assert first.status_code == 201
    second = client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("cert-again.txt", io.BytesIO(content.encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )
    assert second.status_code == 409


def test_filename_never_controls_storage_path():
    """A traversal-style filename must not escape the uploads directory."""
    import os
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    escaped_files = [
        os.path.join(backend_dir, "evil.txt"),                 # ../../evil.txt target
        os.path.join(os.path.dirname(backend_dir), "evil.txt")  # one level higher
    ]
    sid = _create_supplier("Traversal Guard Pvt Ltd")
    res = client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("../../evil.txt", io.BytesIO("Company Name: X\nGSTIN: 09ABCDE1234F125\n".encode()), "text/plain")},
        data={"document_type": "OTHER"},
    )
    assert res.status_code == 201
    for escaped in escaped_files:
        assert not os.path.exists(escaped), f"file escaped uploads dir: {escaped}"


# ------------------------------------------------------------------ unreadable-upload honesty

def test_random_image_upload_is_flagged_high_risk_not_low():
    """THE user-reported bug: an unreadable image must never score as healthy."""
    sid = _create_supplier("Scanned Docs Pvt Ltd")
    upload = client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("scan_random.png", io.BytesIO(_png_bytes()), "image/png")},
        data={"document_type": "ISO_CERT"},
    )
    assert upload.status_code == 201
    body = upload.json()
    assert body["status"] == "NEEDS_OCR"

    report = client.post(f"/api/suppliers/{sid}/analyze").json()
    assert report["data_source"] == "UPLOADED_DOCUMENTS"
    assert report["document_count"] == 1
    assert report["risk_level"] == "HIGH", f"risk_score={report['risk_score']}"
    assert report["risk_score"] < 60
    assert any("could not be read" in f["message"] for f in report["key_findings"])
    assert any(f["severity"] == "danger" for f in report["key_findings"])
    assert "no blocking discrepancies" not in report["summary"].lower()


def test_readable_text_without_identifiers_is_not_low_risk():
    """Readable but identifier-free content must at least demand manual review."""
    sid = _create_supplier("Chatty Letter Pvt Ltd")
    client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("letter.txt", io.BytesIO(b"Dear team, thank you for the meeting yesterday. We look forward to the visit next week. Regards, Sales Desk."), "text/plain")},
        data={"document_type": "OTHER"},
    )
    report = client.post(f"/api/suppliers/{sid}/analyze").json()
    assert report["data_source"] == "UPLOADED_DOCUMENTS"
    assert report["risk_level"] != "LOW"
    assert report["risk_score"] <= 74


# ------------------------------------------------------------------ XSS

def test_export_html_escapes_malicious_supplier_name():
    """Stored XSS: a <script> supplier name must never reach the HTML export raw."""
    evil_name = "Evil <script>alert(1)</script> Pvt Ltd"
    sid = _create_supplier(evil_name)
    client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("gst.txt", io.BytesIO("Company Name: Evil Co\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n".encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )
    client.post(f"/api/suppliers/{sid}/analyze")

    html = client.get(f"/api/suppliers/{sid}/report/export?format=html").text
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html
