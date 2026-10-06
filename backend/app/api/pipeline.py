"""
Pipeline API: Async 8-stage verification pipeline with polling and SSE stream.
"""

import json
import asyncio
from typing import Dict, Any, List
from threading import Thread

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.entities import PipelineJob, Supplier, User
from app.services.pipeline_service import pipeline_service, PIPELINE_STAGES

router = APIRouter()


@router.post("/jobs/{supplier_id}")
def start_pipeline_job(
    supplier_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Starts an asynchronous 8-stage verification pipeline job for a supplier."""
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    job = pipeline_service.create_job(db, supplier_id)

    # Launch execution in background thread
    background_tasks.add_task(pipeline_service.execute_pipeline, job.job_id)

    return {
        "job_id": job.job_id,
        "supplier_id": supplier.supplier_id,
        "status": job.status,
        "current_stage": job.current_stage,
        "created_at": job.created_at,
        "stages": PIPELINE_STAGES,
    }


@router.get("/jobs/{job_id}")
def get_pipeline_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Poll the status and timing breakdown of an asynchronous pipeline job."""
    job = db.query(PipelineJob).filter(PipelineJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline job not found")

    return {
        "job_id": job.job_id,
        "supplier_id": job.supplier_id,
        "status": job.status,
        "current_stage": job.current_stage,
        "stages_data": job.stages_data,
        "failure_reason": job.failure_reason,
        "retry_count": job.retry_count,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


@router.post("/jobs/{job_id}/retry")
def retry_pipeline_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retries a failed pipeline job."""
    job = pipeline_service.retry_job(db, job_id)
    if not job:
        raise HTTPException(status_code=400, detail="Job cannot be retried (must be in FAILED status)")

    background_tasks.add_task(pipeline_service.execute_pipeline, job.job_id)

    return {
        "message": "Job retry initiated",
        "job_id": job.job_id,
        "status": job.status,
        "retry_count": job.retry_count,
    }


@router.get("/jobs/{job_id}/stream")
async def stream_pipeline_job(
    job_id: str,
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) endpoint to stream real-time stage progress."""
    job = db.query(PipelineJob).filter(PipelineJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline job not found")

    async def event_generator():
        last_stage = None
        last_status = None
        while True:
            # Refresh job state
            current_job = db.query(PipelineJob).filter(PipelineJob.job_id == job_id).first()
            if not current_job:
                break

            if current_job.current_stage != last_stage or current_job.status != last_status:
                payload = {
                    "job_id": current_job.job_id,
                    "status": current_job.status,
                    "current_stage": current_job.current_stage,
                    "stages_data": current_job.stages_data,
                    "failure_reason": current_job.failure_reason,
                }
                yield f"data: {json.dumps(payload)}\n\n"
                last_stage = current_job.current_stage
                last_status = current_job.status

            if current_job.status in ("COMPLETED", "FAILED"):
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
