"""
Phase 7: Demo seed script.

Creates six clearly-labelled synthetic supplier profiles through the REAL
product pipeline (API calls against the in-process app — no shortcuts, no
invented data in the database), so a demo shows every thesis behaviour:

  1. Clean supplier, complete consistent documents  -> ASSESSED, healthy
  2. Cross-document bank/name mismatch              -> flagged finding
  3. Shared-director network                        -> via demo fixture
  4. Expired certificate                            -> EXPIRED finding
  5. No documents at all                            -> NOT_ASSESSABLE (no score)
  6. Unreadable scan (image, no OCR)                -> NEEDS_OCR, never healthy

Usage (from backend/):
    python scripts/seed_demo.py            # add demo profiles
    python scripts/seed_demo.py --reset    # wipe the dev DB and re-seed
"""

import argparse
import io
import struct
import sys
import zlib
from datetime import date, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

parser = argparse.ArgumentParser(description="Seed the VendorGuard demo workspace.")
parser.add_argument("--reset", action="store_true",
                    help="Delete the development database first so the demo starts clean.")
args = parser.parse_args()

DB_PATH = BACKEND_DIR / "vendorguard.db"
if args.reset and DB_PATH.exists():
    DB_PATH.unlink()
    print(f"[seed] removed existing database: {DB_PATH.name}")

# App import happens AFTER the optional reset so tables are created fresh.
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.services.validators import generate_valid_gstin, validate_gstin  # noqa: E402

client = TestClient(app)


def login() -> None:
    res = client.post("/api/auth/login", json={
        "email": settings.ADMIN_EMAIL,
        "password": settings.ADMIN_PASSWORD,
    })
    assert res.status_code == 200, f"admin login failed: {res.text}"
    client.headers.update({"Authorization": f"Bearer {res.json()['access_token']}"})


def create_supplier(name: str) -> str:
    res = client.post("/api/suppliers", json={
        "name": name,
        "business_type": "Private Limited",
        "industry": "Manufacturing",
    })
    assert res.status_code == 201, res.text
    return res.json()["supplier_id"]


def upload(supplier_id: str, filename: str, content: str, doc_type: str) -> None:
    res = client.post(
        f"/api/suppliers/{supplier_id}/documents",
        files={"file": (filename, io.BytesIO(content.encode()), "text/plain")},
        data={"document_type": doc_type},
    )
    assert res.status_code == 201, res.text


def upload_png(supplier_id: str, filename: str) -> None:
    def chunk(ctype: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + ctype + data
                + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF))

    header = struct.pack(">IIBBBBB", 32, 32, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + bytes(((x * 41 + y * 13) % 256) for x in range(96)) for y in range(32))
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
           + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
    res = client.post(
        f"/api/suppliers/{supplier_id}/documents",
        files={"file": (filename, io.BytesIO(png), "image/png")},
        data={"document_type": "ISO_CERT"},
    )
    assert res.status_code == 201, res.text


def analyze(supplier_id: str) -> dict:
    res = client.post(f"/api/suppliers/{supplier_id}/analyze")
    assert res.status_code == 200, res.text
    return res.json()


def iso_expiry_text(days: int) -> str:
    return (date.today() + timedelta(days=days)).strftime("%d-%m-%Y")


def main() -> None:
    login()
    created: list[tuple[str, dict, str]] = []   # (label, report, supplier_id)

    # 1 ── Clean, complete, consistent ------------------------------------
    sid = create_supplier("DEMO 1 · Veridian Packaging Industries")
    gstin = generate_valid_gstin(state_code="27", pan="AAACV1234C")
    assert validate_gstin(gstin)["passed"]
    upload(sid, "gst_certificate.txt", (
        "GST Registration Certificate\n"
        "Legal Name: Veridian Packaging Industries Pvt Ltd\n"
        f"GSTIN: {gstin}\n"
        "PAN: AAACV1234C\n"
        "State: Maharashtra\n"
    ), "GST_CERT")
    upload(sid, "bank_letter.txt", (
        "Bank Confirmation Letter\n"
        "Account Number 123456789012\n"
        "IFSC Code: HDFC0000123\n"
        "Account holder: Veridian Packaging Industries Pvt Ltd\n"
    ), "BANK_STATEMENT")
    upload(sid, "iso_certificate.txt", (
        "ISO 9001:2015 Quality Management Certificate\n"
        "Issued to Veridian Packaging Industries Pvt Ltd\n"
        f"Certificate valid until {iso_expiry_text(400)}\n"
    ), "ISO_CERT")
    created.append(("1 · Clean & complete (healthy)", analyze(sid), sid))

    # 2 ── Bank / name mismatch -------------------------------------------
    sid = create_supplier("DEMO 2 · Sunder Textiles Pvt Ltd")
    gstin = generate_valid_gstin(state_code="24", pan="AABCS9876L")
    upload(sid, "gst_certificate.txt", (
        "GST Registration Certificate\n"
        "Legal Name: Sunder Textiles Pvt Ltd\n"
        f"GSTIN: {gstin}\n"
        "PAN: AABCS9876L\n"
    ), "GST_CERT")
    upload(sid, "cheque.txt", (
        "Cancelled Cheque\n"
        "Account Number 987650001234\n"
        "IFSC Code: ICIC0000456\n"
        "Account holder: Sunder Traders\n"          # does not match legal name
    ), "BANK_STATEMENT")
    created.append(("2 · Bank holder mismatch", analyze(sid), sid))

    # 4 ── Expired certificate --------------------------------------------
    sid = create_supplier("DEMO 4 · Oceanic Polymer Exports LLP")
    gstin = generate_valid_gstin(state_code="33", pan="AAGFO2211K")
    upload(sid, "gst_certificate.txt", (
        "GST Registration Certificate\n"
        "Legal Name: Oceanic Polymer Exports LLP\n"
        f"GSTIN: {gstin}\n"
        "PAN: AAGFO2211K\n"
    ), "GST_CERT")
    upload(sid, "iso_certificate.txt", (
        "ISO 9001:2015 Certificate\n"
        "Issued to Oceanic Polymer Exports LLP\n"
        f"Certificate expired on {iso_expiry_text(-30)}\n"
    ), "ISO_CERT")
    created.append(("4 · Expired certificate", analyze(sid), sid))

    # 5 ── No documents at all -> must be NOT_ASSESSABLE ------------------
    sid = create_supplier("DEMO 5 · Barely Known Traders Pvt Ltd")
    created.append(("5 · No documents (trust core)", analyze(sid), sid))

    # 6 ── Unreadable scan -> flagged, never scored healthy ---------------
    sid = create_supplier("DEMO 6 · Faded Scan Industries Pvt Ltd")
    upload_png(sid, "scanned_certificate.png")
    created.append(("6 · Unreadable scan", analyze(sid), sid))

    # 3 ── Shared-director network: the demo fixture supplier -------------
    client.get("/api/suppliers")  # seeds fixture suppliers when the table is empty
    fixture = client.get("/api/suppliers/sup-abc-pkg-001/report")
    if fixture.status_code == 200:
        created.append(("3 · Shared-director network (fixture)", fixture.json(), "sup-abc-pkg-001"))

    # ── Report ───────────────────────────────────────────────────────────
    print("\n===== VendorGuard demo workspace seeded =====")
    for label, report, _sid in created:
        state = report.get("assessment_state")
        score = report.get("risk_score")
        score_text = f"{score}/100" if score is not None else "N/A (not assessable)"
        print(f"  DEMO {label:44s} {state:16s} {score_text:20s} {report.get('risk_level') or ''}")
        for f in report.get("key_findings", [])[:3]:
            print(f"        - [{f['severity']}] {f['message'][:96]}")

    # Thesis-critical acceptance checks (Phase 7 spec items 5 and 6)
    _label5, no_docs, _sid5 = created[3]
    assert no_docs["assessment_state"] == "NOT_ASSESSABLE", no_docs["assessment_state"]
    assert no_docs["risk_score"] is None, "no-evidence supplier must not show a score"

    _label6, unreadable, unreadable_sid = created[4]
    docs = client.get(f"/api/suppliers/{unreadable_sid}/documents").json()
    assert docs and docs[0]["status"] == "NEEDS_OCR", docs
    assert unreadable["assessment_state"] == "NOT_ASSESSABLE", unreadable["assessment_state"]

    print("\n[ok] No-documents supplier is NOT_ASSESSABLE with no numeric score.")
    print("[ok] Unreadable scan stored as NEEDS_OCR and the supplier stays NOT_ASSESSABLE.")
    print("\nRun the app:  uvicorn app.main:app --port 8000   +   npm run dev  (frontend)")
    print("Sign in with ADMIN_EMAIL / ADMIN_PASSWORD (see .env.example).")


if __name__ == "__main__":
    main()
