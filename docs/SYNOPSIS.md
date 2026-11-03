# Project Synopsis: VendorGuard AI

**Evidence-Grounded Supplier Verification & Predictive Risk Intelligence Platform**  
*Verify the Supplier. Verify the Evidence. Verify the AI.*  
Academic Year 2026–2027

---

## Cover Information

* **Project Title:** VendorGuard AI – Evidence-Grounded Supplier Verification, Predictive Risk Intelligence & AI Reliability Platform
* **Official Problem Statement:** AI-Powered B2B Supplier Verification and Predictive Trust Scoring Engine
* **Candidate:** Aditya Yadav (Roll No: 2315510016)
* **Institute:** GLA University, Mathura – B.Tech (AI & ML), 4th Year (Final Year)
* **Team Size:** 1 (Individual Project)
* **Repository:** `https://github.com/adityayadav161003/VendorGuardAI`
* **Version / Date:** Draft v0.1 / 05 October 2026

---

## 1. Overview & Scope Boundaries

### 1.1 Problem Statement
Businesses onboarding unfamiliar suppliers must review GST, PAN, company registration, ISO/compliance, bank, and invoice documents, cross-checking them against external sources and judging risk. This manual process is slow, error-prone, and difficult to audit. Furthermore, generic LLM summarizers introduce hallucinated claims without verifiable backing.

### 1.2 Non-Goals
* No definitive legal finding that a supplier is fraudulent.
* No automatic purchases, payments, contracts, or blacklisting.
* No claim of live government-registry verification unless an authorized source/API is actually available.
* No paid proprietary AI API as a mandatory core dependency.

---

## 2. Acceptance Criteria (AC1 – AC6)

* **AC1:** Supported PDF/image uploads are stored and processed or fail safely.
* **AC2:** Extracted fields show source page/snippet and confidence where available.
* **AC3:** Known cross-document conflicts are flagged with both sources.
* **AC4:** AI claims are labeled supported, contradicted, or insufficient evidence with evidence links.
* **AC5:** Reports show risk indicators, explanations, evidence, and limitations.
* **AC6:** Evaluation includes baselines, error analysis, and reproducible metrics.

---

## 3. Technology Stack & Architectural Decisions

* **Architecture:** Modular Monolith with separated Python modules and API boundaries to minimize solo-developer maintenance overhead.
* **Backend:** Python 3.11+, FastAPI, Pydantic, SQLAlchemy, SQLite/PostgreSQL.
* **Document AI:** PyMuPDF, pdfplumber, regex and rule-based extraction with OCR fallbacks.
* **Graph Intelligence:** NetworkX for relationship topology, cycle detection, and shell ring analysis.
* **Claim Verification:** Natural Language Inference (NLI) rules/models classifying claims into Supported, Contradicted, or Insufficient Evidence.
* **Risk Engine:** Interpretable multi-vector scoring (Identity, Document, Financial, Operational, Network, Reputation) with transparent rule definitions.
* **Frontend:** React, TypeScript, Tailwind CSS, Lucide icons, responsive dashboard.
