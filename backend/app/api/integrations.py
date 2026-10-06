"""
Integrations API: Scoped API Keys and HMAC-SHA256 Signed Webhooks.
"""

import hmac
import hashlib
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.entities import ApiKey, WebhookEndpoint, User
from app.services.audit import record_event

router = APIRouter()

VALID_SCOPES = {"read:reports", "write:documents", "read:suppliers", "admin"}
VALID_WEBHOOK_EVENTS = {"analysis.completed", "review.decided", "certificate.expiring"}


class CreateApiKeyRequest(BaseModel):
    name: str = Field(default="Integration Key", max_length=100)
    scopes: List[str] = Field(default=["read:reports", "read:suppliers"])


class CreateWebhookRequest(BaseModel):
    url: str = Field(..., max_length=500)
    events: List[str] = Field(default=["analysis.completed", "certificate.expiring"])
    secret: Optional[str] = Field(default=None, max_length=100)


# -------------------------------------------------------------
# API Key Management
# -------------------------------------------------------------

@router.post("/api-keys")
def create_api_key(
    payload: CreateApiKeyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin-only: Generates a scoped API key for enterprise integrations."""
    for s in payload.scopes:
        if s not in VALID_SCOPES:
            raise HTTPException(status_code=422, detail=f"Invalid scope '{s}'. Allowed: {sorted(VALID_SCOPES)}")

    raw_token = secrets.token_hex(24)
    raw_key = f"vg_live_{raw_token}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    prefix = f"vg_live_{raw_token[:6]}..."

    record = ApiKey(
        key_hash=key_hash,
        key_prefix=prefix,
        user_id=current_user.user_id,
        organization=current_user.organization or "GLA Enterprise",
        scopes=payload.scopes,
        is_active=1,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    record_event(
        db,
        action="API_KEY_CREATED",
        object_id=record.key_id,
        user_id=current_user.user_id,
        details={"scopes": payload.scopes, "prefix": prefix}
    )

    return {
        "key_id": record.key_id,
        "api_key": raw_key,  # Returned ONLY on creation
        "key_prefix": prefix,
        "scopes": record.scopes,
        "created_at": record.created_at.isoformat(),
        "warning": "Store this key securely. It will not be shown again.",
    }


@router.get("/api-keys")
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin-only: Lists active API keys and their assigned scopes."""
    org = current_user.organization or "GLA Enterprise"
    keys = (
        db.query(ApiKey)
        .filter(ApiKey.organization == org, ApiKey.is_active == 1)
        .order_by(ApiKey.created_at.desc())
        .all()
    )

    return [
        {
            "key_id": k.key_id,
            "key_prefix": k.key_prefix,
            "scopes": k.scopes,
            "created_at": k.created_at.isoformat() if k.created_at else "",
        }
        for k in keys
    ]


@router.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin-only: Immediately revokes an API key."""
    key = db.query(ApiKey).filter(ApiKey.key_id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    key.is_active = 0
    db.commit()

    record_event(db, action="API_KEY_REVOKED", object_id=key.key_id, user_id=current_user.user_id)
    return {"message": "API key revoked successfully."}


# -------------------------------------------------------------
# Webhook Management
# -------------------------------------------------------------

@router.post("/webhooks")
def register_webhook(
    payload: CreateWebhookRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin-only: Registers a webhook endpoint with HMAC secret."""
    for ev in payload.events:
        if ev not in VALID_WEBHOOK_EVENTS:
            raise HTTPException(status_code=422, detail=f"Invalid event '{ev}'. Allowed: {sorted(VALID_WEBHOOK_EVENTS)}")

    secret = payload.secret or secrets.token_hex(20)
    endpoint = WebhookEndpoint(
        organization=current_user.organization or "GLA Enterprise",
        url=payload.url,
        secret=secret,
        events=payload.events,
        is_active=1,
    )
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)

    record_event(
        db,
        action="WEBHOOK_REGISTERED",
        object_id=endpoint.endpoint_id,
        user_id=current_user.user_id,
        details={"url": payload.url, "events": payload.events}
    )

    return {
        "endpoint_id": endpoint.endpoint_id,
        "url": endpoint.url,
        "secret": endpoint.secret,
        "events": endpoint.events,
        "is_active": bool(endpoint.is_active),
    }


@router.get("/webhooks")
def list_webhooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin-only: Lists registered webhook endpoints."""
    org = current_user.organization or "GLA Enterprise"
    endpoints = db.query(WebhookEndpoint).filter(WebhookEndpoint.organization == org).all()

    return [
        {
            "endpoint_id": ep.endpoint_id,
            "url": ep.url,
            "events": ep.events,
            "is_active": bool(ep.is_active),
            "created_at": ep.created_at.isoformat() if ep.created_at else "",
        }
        for ep in endpoints
    ]


@router.post("/webhooks/{endpoint_id}/test")
def test_webhook_dispatch(
    endpoint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Dispatches a test HMAC-signed webhook event."""
    ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.endpoint_id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Webhook endpoint not found")

    import json
    test_payload = {
        "event": "test.ping",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "organization": ep.organization,
        "data": {"message": "VendorGuard AI Webhook Delivery Verification"},
    }
    payload_bytes = json.dumps(test_payload).encode()
    signature = hmac.new(ep.secret.encode(), payload_bytes, hashlib.sha256).hexdigest()

    return {
        "status": "DELIVERY_SIMULATED",
        "url": ep.url,
        "headers": {
            "Content-Type": "application/json",
            "X-VendorGuard-Signature": f"sha256={signature}",
            "X-VendorGuard-Event": "test.ping",
        },
        "payload": test_payload,
        "signature": signature,
    }
