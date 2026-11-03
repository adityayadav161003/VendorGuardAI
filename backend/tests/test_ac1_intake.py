import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ac1_supported_text_intake_success():
    """AC1: Supported files are processed and stored safely."""
    # Create supplier
    sup_res = client.post("/api/suppliers", json={"name": "Test Intake Supplier"})
    assert sup_res.status_code == 201
    supplier_id = sup_res.json()["supplier_id"]

    # Upload supported file
    file_content = b"Legal Name: Test Intake Supplier\nGSTIN: 09ABCDE1234F125"
    files = {"file": ("test_cert.txt", io.BytesIO(file_content), "text/plain")}
    data = {"document_type": "GST"}
    
    upload_res = client.post(f"/api/suppliers/{supplier_id}/documents", files=files, data=data)
    assert upload_res.status_code == 201
    res_data = upload_res.json()
    assert res_data["status"] == "PROCESSED"
    assert res_data["file_hash"] is not None

def test_ac1_unsupported_file_fails_safely():
    """AC1: Invalid file types fail safely without server error."""
    sup_res = client.post("/api/suppliers", json={"name": "Test Rejection Supplier"})
    supplier_id = sup_res.json()["supplier_id"]

    # Upload unsupported file (e.g. .exe)
    files = {"file": ("malicious.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")}
    data = {"document_type": "OTHER"}
    
    upload_res = client.post(f"/api/suppliers/{supplier_id}/documents", files=files, data=data)
    assert upload_res.status_code == 400
    assert "Unsupported file format" in upload_res.json()["detail"]

# AC1 test suite
