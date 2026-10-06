"""
Evaluation API: Run and inspect automated benchmarks on synthetic fixtures.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.entities import EvalBenchmarkRun, User
from app.services.eval_harness import eval_harness, BENCHMARK_DISCLAIMER

router = APIRouter()


@router.post("/run")
def trigger_benchmark_run(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "reviewer")),
):
    """
    Executes automated quality evaluation on synthetic benchmark fixtures:
    Field extraction (P/R/F1), conflict detection, and claim verification confusion matrix.
    """
    return eval_harness.run_benchmark(db)


@router.get("/runs")
def list_benchmark_runs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists historical benchmark runs and key accuracy metrics."""
    runs = (
        db.query(EvalBenchmarkRun)
        .order_by(EvalBenchmarkRun.created_at.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "run_id": r.run_id,
            "run_type": r.run_type,
            "sample_count": r.sample_count,
            "metrics": r.metrics,
            "disclaimer": r.disclaimer,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in runs
    ]


@router.get("/runs/{run_id}")
def get_benchmark_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves full details of a specific benchmark run."""
    run = db.query(EvalBenchmarkRun).filter(EvalBenchmarkRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Benchmark run not found")

    return {
        "run_id": run.run_id,
        "run_type": run.run_type,
        "sample_count": run.sample_count,
        "metrics": run.metrics,
        "disclaimer": run.disclaimer,
        "created_at": run.created_at.isoformat() if run.created_at else "",
    }
