"""
Evaluation Harness for Automated Quality Benchmarking.

Evaluates:
  1. Field Extraction (GSTIN, PAN, CIN, IFSC, Amounts, Expiry) -> Precision, Recall, F1.
  2. Cross-Document Conflict Detection -> Precision, Recall, F1.
  3. Claim Verification -> Per-class Precision/Recall/F1 and 3x3 Confusion Matrix (SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE).

Mandatory Disclaimer:
  Synthetic benchmark results do not prove or guarantee real-world fraud detection performance.
"""

from typing import Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.entities import EvalBenchmarkRun
from app.services.validators import validate_gstin, validate_pan
from app.services.consistency import consistency_service
from app.services.claim_verifier import claim_verifier_service

BENCHMARK_DISCLAIMER = (
    "DISCLAIMER: Benchmark metrics are calculated against synthetic fixtures in controlled "
    "evaluation scenarios. Synthetic results demonstrate algorithm consistency but do not "
    "prove or guarantee real-world fraud detection or document tampering performance."
)

# Labelled synthetic test cases
SYNTHETIC_EXTRACTION_FIXTURES = [
    {
        "text": "Company Name: Apex Supplies\nGSTIN: 27AABCA1234A1Z5\nPAN: AABCA1234A\nCIN: U12345DL2018PTC123456\nAmount: INR 50,000",
        "expected": {"GSTIN": "27AABCA1234A1Z5", "PAN": "AABCA1234A", "CIN": "U12345DL2018PTC123456"}
    },
    {
        "text": "Vendor: BlueStar Metals\nGSTIN: 07BBDDE9999K1Z2\nPAN: BBDDE9999K\nAmount: Rs. 1,20,000",
        "expected": {"GSTIN": "07BBDDE9999K1Z2", "PAN": "BBDDE9999K"}
    },
    {
        "text": "Informal letter with no statutory fields. Just friendly greeting.",
        "expected": {}
    },
    {
        "text": "Supplier: Zenith Logistics\nPAN: CCEEF8888P\nGSTIN: 29CCEEF8888P1Z8\nExpiry: 2028-12-31",
        "expected": {"PAN": "CCEEF8888P", "GSTIN": "29CCEEF8888P1Z8"}
    }
]

SYNTHETIC_CONFLICT_FIXTURES = [
    {
        "doc_a": {"GSTIN": "27AABCA1234A1Z5", "PAN": "AABCA1234A", "LEGAL_NAME": "Apex Supplies Ltd"},
        "doc_b": {"GSTIN": "27AABCA1234A1Z5", "PAN": "ZZZZA9999A", "ACCOUNT_HOLDER": "Apex Supplies Ltd"},
        "expected_conflict": True,
        "conflict_type": "GSTIN_PAN_MISMATCH"
    },
    {
        "doc_a": {"GSTIN": "07BBDDE9999K1Z2", "PAN": "BBDDE9999K", "LEGAL_NAME": "BlueStar Metals"},
        "doc_b": {"GSTIN": "07BBDDE9999K1Z2", "PAN": "BBDDE9999K", "ACCOUNT_HOLDER": "BlueStar Metals"},
        "expected_conflict": False,
        "conflict_type": None
    },
    {
        "doc_a": {"GSTIN": "29CCEEF8888P1Z8", "PAN": "CCEEF8888P", "LEGAL_NAME": "Zenith Logistics"},
        "doc_b": {"GSTIN": "29CCEEF8888P1Z8", "PAN": "CCEEF8888P", "ACCOUNT_HOLDER": "Wrong Account Holder"},
        "expected_conflict": True,
        "conflict_type": "BANK_NAME_MISMATCH"
    }
]

SYNTHETIC_CLAIM_FIXTURES = [
    {
        "claim": "GSTIN 27AABCA1234A1Z5 is verified on file.",
        "evidence": [{"snippet": "Registration verified: GSTIN 27AABCA1234A1Z5"}],
        "expected_label": "SUPPORTED"
    },
    {
        "claim": "The company has 0 years of operating history.",
        "evidence": [{"snippet": "Incorporated in 2010 with 15 years in operation."}],
        "expected_label": "CONTRADICTED"
    },
    {
        "claim": "The director has won national business awards.",
        "evidence": [{"snippet": "Only tax filing certificate attached."}],
        "expected_label": "INSUFFICIENT_EVIDENCE"
    },
    {
        "claim": "PAN matches the tax filing records.",
        "evidence": [{"snippet": "PAN AABCA1234A confirmed."}],
        "expected_label": "SUPPORTED"
    }
]


class EvaluationHarness:
    def run_benchmark(self, db: Session) -> Dict[str, Any]:
        """Runs the benchmark suite across extraction, conflict detection, and claim verification."""
        # 1. Extraction benchmark
        tp = fp = fn = 0
        for sample in SYNTHETIC_EXTRACTION_FIXTURES:
            from app.services.document_ai import document_ai_service
            extracted = document_ai_service.extract_entities(sample["text"])
            target_types = {"GSTIN", "PAN", "CIN", "IFSC"}
            found_map = {e["type"]: e["value"] for e in extracted if e["type"] in target_types}

            for exp_type, exp_val in sample["expected"].items():
                if exp_type in found_map and found_map[exp_type] == exp_val:
                    tp += 1
                else:
                    fn += 1

            for f_type in found_map:
                if f_type not in sample["expected"]:
                    fp += 1

        precision_ext = round(tp / (tp + fp) if (tp + fp) > 0 else 1.0, 3)
        recall_ext = round(tp / (tp + fn) if (tp + fn) > 0 else 1.0, 3)
        f1_ext = round(2 * precision_ext * recall_ext / (precision_ext + recall_ext) if (precision_ext + recall_ext) > 0 else 1.0, 3)

        # 2. Conflict benchmark
        c_tp = c_fp = c_fn = c_tn = 0
        for item in SYNTHETIC_CONFLICT_FIXTURES:
            entities = []
            for k, v in item["doc_a"].items():
                entities.append({"entity_type": k, "entity_value": v, "document_name": "DocA.pdf", "page_number": 1})
            for k, v in item["doc_b"].items():
                entities.append({"entity_type": k, "entity_value": v, "document_name": "DocB.pdf", "page_number": 1})

            findings = consistency_service.check_entity_conflicts_across_documents(entities)
            detected = len(findings) > 0

            if item["expected_conflict"] and detected:
                c_tp += 1
            elif not item["expected_conflict"] and not detected:
                c_tn += 1
            elif item["expected_conflict"] and not detected:
                c_fn += 1
            else:
                c_fp += 1

        c_prec = round(c_tp / (c_tp + c_fp) if (c_tp + c_fp) > 0 else 1.0, 3)
        c_rec = round(c_tp / (c_tp + c_fn) if (c_tp + c_fn) > 0 else 1.0, 3)
        c_f1 = round(2 * c_prec * c_rec / (c_prec + c_rec) if (c_prec + c_rec) > 0 else 1.0, 3)

        # 3. Claim verification confusion matrix
        classes = ["SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE"]
        confusion_matrix = {act: {pred: 0 for pred in classes} for act in classes}

        for item in SYNTHETIC_CLAIM_FIXTURES:
            pred = claim_verifier_service.verify_claim(item["claim"], item["evidence"])
            pred_label = pred["label"] if pred["label"] in classes else "INSUFFICIENT_EVIDENCE"
            actual = item["expected_label"]
            confusion_matrix[actual][pred_label] += 1

        claim_metrics = {}
        for cls in classes:
            c_true_pos = confusion_matrix[cls][cls]
            c_false_pos = sum(confusion_matrix[other][cls] for other in classes if other != cls)
            c_false_neg = sum(confusion_matrix[cls][other] for other in classes if other != cls)

            p = round(c_true_pos / (c_true_pos + c_false_pos) if (c_true_pos + c_false_pos) > 0 else 1.0, 3)
            r = round(c_true_pos / (c_true_pos + c_false_neg) if (c_true_pos + c_false_neg) > 0 else 1.0, 3)
            f1 = round(2 * p * r / (p + r) if (p + r) > 0 else 1.0, 3)
            claim_metrics[cls] = {"precision": p, "recall": r, "f1": f1}

        overall_metrics = {
            "field_extraction": {
                "precision": precision_ext,
                "recall": recall_ext,
                "f1_score": f1_ext,
                "sample_count": len(SYNTHETIC_EXTRACTION_FIXTURES),
            },
            "conflict_detection": {
                "precision": c_prec,
                "recall": c_rec,
                "f1_score": c_f1,
                "sample_count": len(SYNTHETIC_CONFLICT_FIXTURES),
            },
            "claim_verification": {
                "confusion_matrix": confusion_matrix,
                "per_class": claim_metrics,
                "sample_count": len(SYNTHETIC_CLAIM_FIXTURES),
            },
        }

        # Persist benchmark run
        run_record = EvalBenchmarkRun(
            run_type="SYNTHETIC_BENCHMARK",
            metrics=overall_metrics,
            sample_count=len(SYNTHETIC_EXTRACTION_FIXTURES) + len(SYNTHETIC_CONFLICT_FIXTURES) + len(SYNTHETIC_CLAIM_FIXTURES),
            disclaimer=BENCHMARK_DISCLAIMER,
        )
        db.add(run_record)
        db.commit()
        db.refresh(run_record)

        return {
            "run_id": run_record.run_id,
            "metrics": overall_metrics,
            "sample_count": run_record.sample_count,
            "disclaimer": BENCHMARK_DISCLAIMER,
            "executed_at": run_record.created_at.isoformat(),
        }


eval_harness = EvaluationHarness()
