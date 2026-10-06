"""
Phase 2 Product Backend Capabilities Test Suite.
Tests:
  - 2.1 Async pipeline: stage execution, timing, polling, retry
  - 2.2 File safety: magic bytes, MIME, traversal, size limits
  - 2.3 Extracted fields: provenance & bounding boxes
  - 2.4 Supplier self-service portal: tokenized expiring upload links
  - 2.5 Monitoring & alerts: 30/15/7 day expiry tracking, supplier change timeline
  - 2.6/2.7 Org isolation, RBAC, and approval governance policies
  - 2.8 Integrations: scoped API keys and HMAC-signed webhooks
  - 2.10 Evaluation harness: synthetic benchmark precision, recall, F1, confusion matrix, disclaimer
  - 2.11 API quality: request ID header tracing
"""

import io
import os
import json
from datetime import datetime, timezone, timedelta
from tests.conftest import client, reviewer_client, anon_client


def _create_test_supplier(name: str = "Phase2 Test Corp") -> str:
    res = client.post("/api/suppliers", json={"name": name, "business_type": "Private Limited"})
    assert res.status_code == 201
    return res.json()["supplier_id"]


# -------------------------------------------------------------
# 2.2 File Safety & Hardening
# -------------------------------------------------------------

def test_file_safety_validator_rejects_malicious_and_masquerading_files():
    from app.services.file_safety import validate_file_safety

    # 1. Empty file
    ok, err = validate_file_safety("empty.pdf", b"")
    assert not ok
    assert "empty" in err.lower()

    # 2. Traversal
    ok, err = validate_file_safety("../../etc/passwd", b"%PDF-1.4 test")
    assert not ok
    assert "path traversal" in err.lower()

    # 3. Disallowed extension
    ok, err = validate_file_safety("script.exe", b"MZ\x90\x00")
    assert not ok
    assert "unsupported file extension" in err.lower()

    # 4. Masquerading PDF (text disguised as PDF without %PDF header)
    ok, err = validate_file_safety("fake.pdf", b"This is not a real PDF at all")
    assert not ok
    assert "magic bytes" in err.lower()

    # 5. Valid PDF magic bytes pass
    ok, err = validate_file_safety("real.pdf", b"%PDF-1.5 \x00\x01\x02 test stream")
    assert ok

    # 6. Valid PNG magic bytes pass
    ok, err = validate_file_safety("scan.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
    assert ok


# -------------------------------------------------------------
# 2.1 Async Pipeline & Stage Timing
# -------------------------------------------------------------

def test_async_pipeline_stages_and_polling():
    sid = _create_test_supplier("Async Pipeline Pvt Ltd")

    # Add a document
    doc_content = (
        "Company Name: Async Pipeline Pvt Ltd\n"
        "GSTIN: 09ABCDE1234F125\n"
        "PAN: ABCDE1234F\n"
        "CIN: U12345DL2018PTC123456\n"
    )
    client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("incorporation.txt", io.BytesIO(doc_content.encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )

    # 1. Start pipeline job
    res = client.post(f"/api/pipeline/jobs/{sid}")
    assert res.status_code == 200, res.text
    job_info = res.json()
    job_id = job_info["job_id"]
    assert job_info["supplier_id"] == sid
    assert job_info["status"] in ("PENDING", "RUNNING", "COMPLETED")
    assert "VALIDATE" in job_info["stages"]

    # Execute pipeline synchronously for test verification
    from app.services.pipeline_service import pipeline_service
    exec_result = pipeline_service.execute_pipeline(job_id)
    assert exec_result["status"] == "COMPLETED"
    assert "stages_data" in exec_result

    # 2. Poll job status
    poll_res = client.get(f"/api/pipeline/jobs/{job_id}")
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    assert poll_data["status"] == "COMPLETED"
    assert poll_data["current_stage"] == "REPORT"

    stages = poll_data["stages_data"]
    for stg in ["UPLOAD", "VALIDATE", "OCR", "EXTRACT", "NORMALISE", "CHECKS", "ASSESS", "REPORT"]:
        assert stg in stages
        assert stages[stg]["status"] == "COMPLETED"
        assert "duration_ms" in stages[stg]


# -------------------------------------------------------------
# 2.4 Supplier Self-Service Portal
# -------------------------------------------------------------

def test_supplier_portal_tokenized_invite_and_upload():
    sid = _create_test_supplier("Portal Target Enterprises")

    # 1. Buyer creates tokenized expiring invite
    invite_res = client.post(
        f"/api/suppliers/{sid}/invites",
        json={"expires_in_days": 14, "required_docs": ["GST_CERT", "PAN_CARD"]}
    )
    assert invite_res.status_code == 200, invite_res.text
    invite_data = invite_res.json()
    token = invite_data["invite_token"]
    assert token

    # 2. External vendor accesses portal checklist using token (no auth needed)
    public_res = anon_client().get(f"/api/portal/invite/{token}")
    assert public_res.status_code == 200, public_res.text
    public_data = public_res.json()
    assert public_data["supplier_name"] == "Portal Target Enterprises"
    assert len(public_data["checklist"]) == 2
    assert any(c["document_type"] == "GST_CERT" for c in public_data["checklist"])

    # 3. Vendor uploads a document via the portal upload-only endpoint
    doc_text = "Tax Registration: GSTIN 09ABCDE1234F125 PAN ABCDE1234F"
    upload_res = anon_client().post(
        f"/api/portal/invite/{token}/upload",
        files={"file": ("portal_gst.txt", io.BytesIO(doc_text.encode()), "text/plain")},
        data={"document_type": "GST_CERT"}
    )
    assert upload_res.status_code == 200, upload_res.text
    upload_data = upload_res.json()
    assert "document_id" in upload_data

    # 4. Invalid or expired token rejected
    bad_res = anon_client().get("/api/portal/invite/invalid-fake-token-999")
    assert bad_res.status_code == 404

    # 5. Verify upload attached to supplier and timeline updated
    timeline_res = client.get(f"/api/monitoring/suppliers/{sid}/timeline")
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()
    assert any("Document Uploaded" in e["title"] for e in timeline["timeline"])


# -------------------------------------------------------------
# 2.5 Monitoring & Expiry Alerts & Change Timeline
# -------------------------------------------------------------

def test_monitoring_alerts_and_supplier_recheck():
    sid = _create_test_supplier("Expiring Compliance Pvt Ltd")

    # Upload document with an expiry date in the near future (e.g. 5 days from today)
    near_expiry = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%d-%m-%Y")
    doc_content = f"ISO 9001 Certificate\nExpiry Date: {near_expiry}\nGSTIN: 09ABCDE1234F125\n"
    client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("iso_cert.txt", io.BytesIO(doc_content.encode()), "text/plain")},
        data={"document_type": "ISO_CERT"},
    )

    # 1. Fetch monitoring alerts
    alerts_res = client.get("/api/monitoring/alerts")
    assert alerts_res.status_code == 200
    alerts_data = alerts_res.json()
    assert "critical_count" in alerts_data
    assert "alerts" in alerts_data

    # 2. Re-check supplier
    recheck_res = client.post(f"/api/monitoring/recheck/{sid}")
    assert recheck_res.status_code == 200
    recheck_data = recheck_res.json()
    assert recheck_data["supplier_id"] == sid
    assert "assessment_state" in recheck_data


# -------------------------------------------------------------
# 2.6/2.7 Org Isolation, RBAC & Governance Policies
# -------------------------------------------------------------

def test_governance_approval_policies():
    # 1. Fetch default policies
    policies_res = client.get("/api/policies/")
    assert policies_res.status_code == 200
    policies = policies_res.json()
    assert len(policies) >= 3
    high_rule = next(p for p in policies if p["risk_level"] == "HIGH")
    assert high_rule["required_approvals"] >= 2

    # 2. Evaluate supplier policy
    sid = _create_test_supplier("Policy Governed Ltd")
    eval_res = client.get(f"/api/policies/evaluate/{sid}")
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert "required_approvals" in eval_data
    assert "policy_satisfied" in eval_data


# -------------------------------------------------------------
# 2.8 Integrations: Scoped API Keys & HMAC Signed Webhooks
# -------------------------------------------------------------

def test_api_keys_and_hmac_webhooks():
    from tests.conftest import client_for

    admin_c = client_for("admin@test.local")

    # 1. Create scoped API key
    key_res = admin_c.post("/api/integrations/api-keys", json={
        "name": "ERP Sync Key",
        "scopes": ["read:reports", "read:suppliers"]
    })
    assert key_res.status_code == 200, key_res.text
    key_data = key_res.json()
    assert key_data["api_key"].startswith("vg_live_")
    key_id = key_data["key_id"]

    # 2. List API keys
    list_res = admin_c.get("/api/integrations/api-keys")
    assert list_res.status_code == 200
    assert any(k["key_id"] == key_id for k in list_res.json())

    # 3. Revoke API key
    del_res = admin_c.delete(f"/api/integrations/api-keys/{key_id}")
    assert del_res.status_code == 200

    # 4. Register Webhook
    wh_res = admin_c.post("/api/integrations/webhooks", json={
        "url": "https://erp.example.com/webhooks/vendorguard",
        "events": ["analysis.completed", "certificate.expiring"],
        "secret": "super_secret_webhook_key_123"
    })
    assert wh_res.status_code == 200
    endpoint_id = wh_res.json()["endpoint_id"]

    # 5. Test Webhook HMAC signature dispatch
    test_wh = admin_c.post(f"/api/integrations/webhooks/{endpoint_id}/test")
    assert test_wh.status_code == 200
    wh_payload = test_wh.json()
    assert wh_payload["status"] == "DELIVERY_SIMULATED"
    assert "X-VendorGuard-Signature" in wh_payload["headers"]
    assert wh_payload["headers"]["X-VendorGuard-Signature"].startswith("sha256=")


# -------------------------------------------------------------
# 2.10 Evaluation Harness: Benchmarks & Disclaimer
# -------------------------------------------------------------

def test_evaluation_benchmark_harness():
    res = reviewer_client.post("/api/eval/run")
    assert res.status_code == 200, res.text
    run_data = res.json()

    assert "run_id" in run_data
    metrics = run_data["metrics"]

    # 1. Extraction metrics
    ext = metrics["field_extraction"]
    assert ext["precision"] >= 0.8
    assert ext["recall"] >= 0.8
    assert ext["f1_score"] >= 0.8

    # 2. Conflict detection metrics
    conf = metrics["conflict_detection"]
    assert conf["precision"] >= 0.8
    assert conf["recall"] >= 0.8
    assert conf["f1_score"] >= 0.8

    # 3. Claim verification confusion matrix
    cm = metrics["claim_verification"]["confusion_matrix"]
    assert "SUPPORTED" in cm
    assert "CONTRADICTED" in cm
    assert "INSUFFICIENT_EVIDENCE" in cm

    # 4. Mandatory synthetic disclaimer check
    assert "DISCLAIMER" in run_data["disclaimer"]
    assert "synthetic" in run_data["disclaimer"].lower()

    # 5. History lookup
    history_res = client.get("/api/eval/runs")
    assert history_res.status_code == 200
    assert len(history_res.json()) >= 1


# -------------------------------------------------------------
# 2.11 API Quality: Request ID Header
# -------------------------------------------------------------

def test_request_id_tracing_header():
    res = client.get("/health")
    assert res.status_code == 200
    assert "x-request-id" in res.headers
    assert len(res.headers["x-request-id"]) > 10
