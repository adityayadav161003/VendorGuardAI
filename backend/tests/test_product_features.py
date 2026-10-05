"""
Product-feature regression tests for the document-driven pipeline:
document-driven analysis, cross-document conflicts, grounded chat,
claim review persistence, alerts, report export and supplier PATCH.
"""
import io

from tests.conftest import client, reviewer_client  # role-authenticated clients


def _create_supplier(name: str) -> str:
    res = client.post("/api/suppliers", json={"name": name})
    assert res.status_code == 201
    return res.json()["supplier_id"]


def _upload(supplier_id: str, filename: str, content: str, doc_type: str = "GST_CERT") -> None:
    res = client.post(
        f"/api/suppliers/{supplier_id}/documents",
        files={"file": (filename, io.BytesIO(content.encode()), "text/plain")},
        data={"document_type": doc_type},
    )
    assert res.status_code == 201, res.text


def test_analysis_uses_uploaded_documents_not_fixtures():
    """The pipeline must derive findings from the uploaded document (mismatched PAN vs GSTIN)."""
    sid = _create_supplier("Doc Driven Industries Pvt Ltd")
    _upload(sid, "gst_cert.txt", (
        "Company Name: Doc Driven Industries Pvt Ltd\n"
        "GSTIN: 27ZZXYZ9999K123\n"
        "PAN: AAAPA1111A\n"
        "Director: Manish Verma\n"
    ))

    res = client.post(f"/api/suppliers/{sid}/analyze")
    assert res.status_code == 200
    report = res.json()

    assert report["data_source"] == "UPLOADED_DOCUMENTS"
    assert report["document_count"] == 1
    # GSTIN 27ZZXYZ9999K123 embeds ZZXYZ9999K != AAAPA1111A -> critical mismatch
    assert any(f["message"].startswith("Critical mismatch") for f in report["key_findings"])
    # A critical tax-identity contradiction forces HIGH risk
    assert report["risk_level"] == "HIGH"
    # No fixture values may leak into the summary
    assert "ABC Pack" not in report["summary"]


def test_cross_document_conflicting_gstin_flagged():
    """Two documents disagreeing on the GSTIN must be flagged citing both files."""
    sid = _create_supplier("Cross Doc Traders LLP")
    _upload(sid, "gst_cert_a.txt", "Company Name: Cross Doc Traders LLP\nGSTIN: 09ABCDE1234F125\n", doc_type="GST_CERT")
    _upload(sid, "invoice_b.txt", "Tax Invoice GSTIN: 24XYZAB5678C1Z5\nBuyer: Cross Doc Traders LLP\n", doc_type="INVOICE")

    res = client.post(f"/api/suppliers/{sid}/analyze")
    assert res.status_code == 200
    report = res.json()

    conflicting = [f for f in report["key_findings"] if f["message"].startswith("Conflicting GSTIN")]
    assert conflicting, report["key_findings"]
    message = conflicting[0]["message"]
    assert "gst_cert_a.txt" in message and "invoice_b.txt" in message
    # Both source documents are cited in the structured finding
    assert any("gst_cert_a.txt" in (f.get("source_reference") or "") for f in conflicting)


def test_claim_review_persists_and_surfaces_in_report():
    """Reviewer decisions must persist and appear when the stored report is replayed."""
    sid = _create_supplier("Review Flow Pvt Ltd")
    _upload(sid, "gst_cert.txt", "Company Name: Review Flow Pvt Ltd\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n")

    report = client.post(f"/api/suppliers/{sid}/analyze").json()
    claim_id = report["claims"][0]["claim_id"]
    assert report["claims"][0]["reviewer_state"] == "PENDING"

    # Procurement users cannot record claim decisions (RBAC)
    forbidden = client.post(f"/api/claims/{claim_id}/review", json={"action": "APPROVED"})
    assert forbidden.status_code == 403

    res = reviewer_client.post(f"/api/claims/{claim_id}/review", json={
        "action": "APPROVED",
        "comment": "Verified against registrar copy",
    })
    assert res.status_code == 200
    assert res.json()["reviewer_state"] == "APPROVED"

    # Stored report replay keeps the human decision
    replay = client.get(f"/api/suppliers/{sid}/report").json()
    assert replay["claims"][0]["claim_id"] == claim_id
    assert replay["claims"][0]["reviewer_state"] == "APPROVED"

    # Invalid actions are rejected
    bad = reviewer_client.post(f"/api/claims/{claim_id}/review", json={"action": "MAYBE"})
    assert bad.status_code == 422


def test_chat_is_grounded_and_admits_insufficient_evidence():
    """Chat must cite retrieved evidence and honestly refuse when nothing matches."""
    sid = _create_supplier("Grounded Chat Pvt Ltd")
    _upload(sid, "bank_letter.txt", (
        "Company Name: Grounded Chat Pvt Ltd\n"
        "Account Number 987654321099 under name 'Grounded Chat Pvt Ltd', IFSC HDFC0000123\n"
    ))

    grounded = client.post("/api/chat", json={
        "supplier_id": sid,
        "question": "Which bank account and IFSC does the company use?",
    }).json()
    assert grounded["citations"], "expected citations from the uploaded bank letter"
    assert grounded["citations"][0]["doc_name"] == "bank_letter.txt"
    assert grounded["verification_status"] in {"GROUNDED_AND_VERIFIED", "PARTIALLY_VERIFIED"}

    unanswerable = client.post("/api/chat", json={
        "supplier_id": sid,
        "question": "Does the supplier sponsor local football matches?",
    }).json()
    assert unanswerable["verification_status"] == "INSUFFICIENT_EVIDENCE"
    assert unanswerable["citations"] == []


def test_report_export_json_and_html():
    sid = _create_supplier("Export Test Pvt Ltd")
    _upload(sid, "gst_cert.txt", "Company Name: Export Test Pvt Ltd\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n")
    client.post(f"/api/suppliers/{sid}/analyze")

    json_res = client.get(f"/api/suppliers/{sid}/report/export?format=json")
    assert json_res.status_code == 200
    assert "attachment" in json_res.headers["content-disposition"]
    assert json_res.json()["supplier_name"] == "Export Test Pvt Ltd"

    html_res = client.get(f"/api/suppliers/{sid}/report/export?format=html")
    assert html_res.status_code == 200
    body = html_res.text
    assert "Export Test Pvt Ltd" in body
    assert "Supplier Risk Report" in body
    assert "Decision-support output only" in body  # responsible-use disclaimer


def test_alerts_derived_from_latest_analysis():
    sid = _create_supplier("Alerts Test Pvt Ltd")
    _upload(sid, "gst_cert.txt", "Company Name: Alerts Test Pvt Ltd\nGSTIN: 27ZZXYZ9999K123\nPAN: AAAPA1111A\n")
    client.post(f"/api/suppliers/{sid}/analyze")

    alerts = client.get(f"/api/suppliers/{sid}/alerts").json()
    assert alerts, "expected at least one alert from the identity mismatch"
    assert all(a["severity"] in ("danger", "warning") for a in alerts)


def test_supplier_patch_updates_and_validates():
    sid = _create_supplier("Patch Me Pvt Ltd")

    # procurement cannot change review status; reviewer can
    assert client.patch(f"/api/suppliers/{sid}", json={"status": "VERIFIED"}).status_code == 403
    ok = reviewer_client.patch(f"/api/suppliers/{sid}", json={"status": "VERIFIED", "website": "https://patchme.example.com"})
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "VERIFIED"
    assert body["website"] == "https://patchme.example.com"

    invalid = reviewer_client.patch(f"/api/suppliers/{sid}", json={"status": "NOT_A_STATUS"})
    assert invalid.status_code == 422

    empty = reviewer_client.patch(f"/api/suppliers/{sid}", json={})
    assert empty.status_code == 422


def test_verify_endpoint_requires_evidence_input():
    res = client.post("/api/claims/verify", json={"claim_text": "The supplier is registered."})
    assert res.status_code == 400


def test_verify_against_supplier_documents():
    sid = _create_supplier("Verify Endpoint Pvt Ltd")
    _upload(sid, "gst_cert.txt", "Company Name: Verify Endpoint Pvt Ltd\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n")

    res = client.post("/api/claims/verify", json={
        "supplier_id": sid,
        "claim_text": "The GSTIN 09ABCDE1234F125 is documented with the matching PAN ABCDE1234F.",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["status"] in {"SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE"}
    assert body["source_doc_name"] == "gst_cert.txt"
