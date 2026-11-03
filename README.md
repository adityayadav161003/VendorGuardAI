# VendorGuard AI 🛡️

> **Evidence-Grounded Supplier Verification, Predictive Risk Intelligence & AI Reliability Platform**  
> *"Verify the Supplier. Verify the Evidence. Verify the AI."*

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-cyan.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-Academic%20Evaluation-orange.svg)]()

---

## 📌 Academic Project Details

* **Project Title:** VendorGuard AI – Evidence-Grounded Supplier Verification, Predictive Risk Intelligence & AI Reliability Platform
* **Official Problem Statement:** AI-Powered B2B Supplier Verification and Predictive Trust Scoring Engine
* **Candidate:** **Aditya Yadav** (Roll No: 2315510016)
* **Program:** B.Tech (AI & ML), 4th Year / Final Year
* **Institute:** GLA University, Mathura
* **Academic Year:** 2026–2027

---

## 🎯 Executive Overview

Businesses onboarding unfamiliar B2B suppliers must review a myriad of documents (GST Certificate, PAN Card, Certificate of Incorporation, Bank Details/Cancelled Cheques, Invoices, and ISO Certifications) and cross-check them against external sources. 

Traditional reviews suffer from:
1. **Siloed & Inconsistent Verification:** Document fraud, name mismatches across bank and tax records, shell companies, and overlapping directorships often go unnoticed.
2. **AI Hallucination in Enterprise Procurement:** Generic LLM-based summarization often hallucinates credentials, invents compliance status, or makes unsupported statements.

**VendorGuard AI** is a decision-support platform designed to automate document ingestion, extract key identifiers with exact source provenance, detect cross-document discrepancies, construct an entity relationship knowledge graph to detect shell networks, and perform **claim-level verification (FEVER-style NLI)** on AI-generated summaries.

---

## 🏛️ System Architecture

VendorGuard AI operates through six interconnected layers:

```
  [1. Data Ingestion] 
     │ Upload GST, PAN, CIN, Bank Statements, Invoices, ISO Certificates
     ▼
  [2. Document Intelligence]
     │ OCR parsing, regex/layout field extraction, confidence scoring & source snippet provenance
     ▼
  [3. Consistency & Normalization]
     │ Cross-document entity matching, bank-name mismatch, PAN-in-GSTIN check, certificate expiry
     ▼
  [4. Knowledge & Evidence Store]
     │ Relational metadata + passage indexing with timestamps and source document IDs
     ▼
  [5. Multi-Vector Risk Engine & Graph Intelligence]
     │ 6-vector risk scoring (Identity, Document, Financial, Operational, Network, Reputation)
     │ NetworkX graph intelligence: shared directors, shell ring & cycle detection
     ▼
  [6. AI Reliability & Reasoning Agent]
     │ Claim-level verification: Supported, Contradicted, or Insufficient Evidence
     │ Evidence-grounded conversational analyst with inline citation badges
     ▼
  [7. Presentation Layer]
     │ Modern React + TypeScript + Tailwind CSS dashboard with interactive risk scorecard & graph explorer
```

---

## 🔬 Core Acceptance Criteria (AC1 – AC6)

* **AC1 (Document Intake):** Validates and safely processes supported PDF/image documents or fails gracefully without crashes.
* **AC2 (Extraction Provenance):** Every extracted field contains the extracted value, confidence score, source page, and exact snippet reference.
* **AC3 (Cross-Document Conflict Detection):** Flags cross-document discrepancies (such as bank account name mismatch and PAN inconsistencies) linking both source references.
* **AC4 (Claim Verification):** Every AI-generated claim is deconstructed and classified as `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT_EVIDENCE` with cited evidence IDs.
* **AC5 (Explainable Risk Indicators):** 0–100 composite risk score with granular breakdown across Identity, Document, Financial, Operational, Network, and Reputation vectors.
* **AC6 (Graph Intelligence):** Identifies planted anomalous patterns (e.g., shared directors across multiple entities or circular links) with inspectable graph topology.

---

## 🚀 Quickstart Guide

### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn app.main:app --reload --port 8000
```
API Documentation will be live at: `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```
Access the dashboard at: `http://localhost:5173`

### 3. Run Automated Evaluation Tests
```bash
cd backend
pytest -v
```

---

## 📖 Research Questions Investigated

1. **RQ1:** How accurately can selected supplier fields be extracted from heterogeneous documents, and which fields are most error-prone?
2. **RQ2:** Do cross-document consistency checks improve detection of discrepancies compared to isolated extraction?
3. **RQ3:** How well does claim-level verification distinguish supported, contradicted, and insufficient-evidence claims?
4. **RQ4:** Can supplier graphs surface planted or labeled suspicious patterns with acceptable false-positive rates?
5. **RQ5:** How does evidence-grounded generation compare with an unverified LLM answer in factual support and traceability?

---

## ⚖️ Responsible Use & Academic Disclaimer

VendorGuard AI is an **academic decision-support prototype**. It provides explainable risk indicators and evidence-grounded audits for human procurement reviewers; it does not issue binding legal determinations or definitive guarantees of supplier fraud.
