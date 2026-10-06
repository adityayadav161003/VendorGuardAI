"""
Business-feature regression tests: tender award engine, live SSE pipeline,
executive analytics, and invoice price-anomaly detection.
"""
import io
import json

from tests.conftest import client, reviewer_client


def _create_supplier(name: str) -> str:
    res = client.post("/api/suppliers", json={"name": name})
    assert res.status_code == 201
    return res.json()["supplier_id"]


def _upload_and_analyze(supplier_id: str, filename: str, content: str) -> dict:
    res = client.post(
        f"/api/suppliers/{supplier_id}/documents",
        files={"file": (filename, io.BytesIO(content.encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )
    assert res.status_code == 201, res.text
    return client.post(f"/api/suppliers/{suppler_id(supplier_id)}/analyze").json()


def suppler_id(sid):  # tiny helper keeps lines readable
    return sid


# ------------------------------------------------------------------ tender engine

def test_tender_evaluation_ranks_and_recommends():
    """A cheap high-risk bid must lose to a compliant one on the composite score."""
    safe_id = _create_supplier("Tender Safe Pvt Ltd")
    risky_id = _create_supplier("Tender Risky Pvt Ltd")

    client.post(
        f"/api/suppliers/{safe_id}/documents",
        files={"file": ("gst.txt", io.BytesIO("Company Name: Tender Safe Pvt Ltd\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n".encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )
    client.post(
        f"/api/suppliers/{risky_id}/documents",
        files={"file": ("gst.txt", io.BytesIO("Company Name: Tender Risky Pvt Ltd\nGSTIN: 27ZZXYZ9999K123\nPAN: AAAPA1111A\n".encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )
    client.post(f"/api/suppliers/{safe_id}/analyze")
    client.post(f"/api/suppliers/{risky_id}/analyze")

    res = client.post("/api/tenders/evaluate", json={
        "quantity": 10000,
        "target_unit_price": 12.50,
        "deadline_days": 21,
        "bids": [
            {"supplier_id": safe_id, "unit_price": 12.00, "lead_time_days": 18},
            {"supplier_id": risky_id, "unit_price": 10.00, "lead_time_days": 30},
        ],
    })
    assert res.status_code == 200, res.text
    body = res.json()

    assert body["recommendation"]["winner_supplier_id"] == safe_id, body["recommendation"]
    risky = next(b for b in body["ranked_bids"] if b["supplier_id"] == risky_id)
    assert "HIGH-RISK SUPPLIER" in risky["flags"]
    assert "LATE DELIVERY" in risky["flags"]
    assert any("decision-support" in line for line in [body["recommendation"]["summary"]])

    # Evaluation persisted for audit
    history = client.get("/api/tenders").json()
    assert any(t["tender_id"] == body["tender_id"] for t in history)


def test_tender_validation():
    res = client.post("/api/tenders/evaluate", json={
        "quantity": 10, "bids": [{"supplier_id": "x", "unit_price": 5}]
    })
    assert res.status_code == 422  # needs >= 2 bids


# ------------------------------------------------------------------ SSE pipeline

def test_analysis_stream_emits_stages_and_final_report():
    sid = _create_supplier("Stream Test Pvt Ltd")
    client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("gst.txt", io.BytesIO("Company Name: Stream Test Pvt Ltd\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n".encode()), "text/plain")},
        data={"document_type": "GST_CERT"},
    )

    with client.stream("GET", f"/api/suppliers/{sid}/analyze/stream") as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    stages = [json.loads(line[6:]) for line in body.split("\n")
              if line.startswith("data: {") and len(line) > 10]
    names = [s["stage"] for s in stages]
    for expected in ["open", "intake", "consistency", "graph", "risk", "claims", "done"]:
        assert expected in names, names
    done = next(s for s in stages if s["stage"] == "done")
    assert done["report"]["supplier_id"] == sid
    assert done["progress"] == 100


# ------------------------------------------------------------------ analytics

def test_analytics_overview_shape():
    res = client.get("/api/analytics/overview")
    assert res.status_code == 200
    body = res.json()
    assert body["totals"]["suppliers"] >= 1
    assert set(body["risk_distribution"].keys()) == {"LOW", "MEDIUM", "HIGH"}
    assert "avg_risk" in body and "vector_averages" in body
    assert isinstance(body["expiry_watchlist"], list)
    assert "support_rate" in body["claim_health"]
    assert isinstance(body["recent_analyses"], list)


# ------------------------------------------------------------------ price anomaly

def test_invoice_price_anomaly_flagged():
    sid = _create_supplier("Price Watch Pvt Ltd")
    invoice = (
        "Invoice from Price Watch Pvt Ltd\n"
        "GSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n"
        "Line total: INR 1,00,000\n"
        "Previous order: Rs. 1,05,000\n"
        "Q2 order: Rs. 98,000\n"
        "Rush order: Rs. 9,50,000\n"
    )
    client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("invoices.txt", io.BytesIO(invoice.encode()), "text/plain")},
        data={"document_type": "INVOICE"},
    )
    report = client.post(f"/api/suppliers/{sid}/analyze").json()

    anomalies = [f for f in report["key_findings"] if f["message"].startswith("Price anomaly")]
    assert anomalies, report["key_findings"]
    assert "950,000" in anomalies[0]["message"]
    assert "fraudulent billing" in anomalies[0]["message"]

    # The analyst summary must mention it too (grounded claim)
    assert "Price anomaly" in report["summary"]


def test_consistent_prices_pass():
    sid = _create_supplier("Stable Pricing Pvt Ltd")
    invoice = (
        "Invoice from Stable Pricing Pvt Ltd\n"
        "GSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F\n"
        "A: INR 1,00,000\nB: Rs. 1,02,000\nC: Rs. 99,000\nD: Rs. 1,01,500\n"
    )
    client.post(
        f"/api/suppliers/{sid}/documents",
        files={"file": ("invoices.txt", io.BytesIO(invoice.encode()), "text/plain")},
        data={"document_type": "INVOICE"},
    )
    report = client.post(f"/api/suppliers/{sid}/analyze").json()
    assert any("fall within the expected range" in f["message"] for f in report["key_findings"])
    assert not any(f["message"].startswith("Price anomaly") for f in report["key_findings"])
