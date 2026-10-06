"""
Policies & Approval Thresholds API.
Enforces multi-approval governance based on supplier risk level (e.g. HIGH risk requires 2 approvals).
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.entities import PolicyRule, Supplier, AnalysisResult, ReviewerAction, User, Claim
from app.services.audit import record_event

router = APIRouter()


class PolicyRuleCreate(BaseModel):
    rule_name: str = Field(..., max_length=100)
    risk_level: str = Field(..., pattern="^(HIGH|MEDIUM|LOW)$")
    required_approvals: int = Field(default=1, ge=1, le=5)
    block_auto_onboard: bool = Field(default=True)


@router.get("/")
def get_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists configured onboarding approval policies for the current organization."""
    org = current_user.organization or "GLA Enterprise"
    policies = db.query(PolicyRule).filter(PolicyRule.organization == org).all()

    # Provide defaults if none configured yet
    if not policies:
        defaults = [
            PolicyRule(organization=org, rule_name="High Risk Dual-Approval Policy", risk_level="HIGH", required_approvals=2, block_auto_onboard=1),
            PolicyRule(organization=org, rule_name="Medium Risk Standard Review", risk_level="MEDIUM", required_approvals=1, block_auto_onboard=1),
            PolicyRule(organization=org, rule_name="Low Risk Fast Track", risk_level="LOW", required_approvals=1, block_auto_onboard=0),
        ]
        db.add_all(defaults)
        db.commit()
        policies = defaults

    return [
        {
            "policy_id": p.policy_id,
            "organization": p.organization,
            "rule_name": p.rule_name,
            "risk_level": p.risk_level,
            "required_approvals": p.required_approvals,
            "block_auto_onboard": bool(p.block_auto_onboard),
        }
        for p in policies
    ]


@router.post("/")
def create_or_update_policy(
    payload: PolicyRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin-only: Configures onboarding approval policy for a risk tier."""
    org = current_user.organization or "GLA Enterprise"
    existing = (
        db.query(PolicyRule)
        .filter(PolicyRule.organization == org, PolicyRule.risk_level == payload.risk_level)
        .first()
    )

    if existing:
        existing.rule_name = payload.rule_name
        existing.required_approvals = payload.required_approvals
        existing.block_auto_onboard = 1 if payload.block_auto_onboard else 0
        rule = existing
    else:
        rule = PolicyRule(
            organization=org,
            rule_name=payload.rule_name,
            risk_level=payload.risk_level,
            required_approvals=payload.required_approvals,
            block_auto_onboard=1 if payload.block_auto_onboard else 0,
        )
        db.add(rule)

    db.commit()
    db.refresh(rule)

    record_event(
        db,
        action="POLICY_RULE_CONFIGURED",
        object_id=rule.policy_id,
        user_id=current_user.user_id,
        details={"risk_level": rule.risk_level, "approvals": rule.required_approvals}
    )

    return {
        "policy_id": rule.policy_id,
        "rule_name": rule.rule_name,
        "risk_level": rule.risk_level,
        "required_approvals": rule.required_approvals,
        "block_auto_onboard": bool(rule.block_auto_onboard),
    }


@router.get("/evaluate/{supplier_id}")
def evaluate_supplier_policy(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates whether the supplier satisfies governance approval policy rules.
    High risk suppliers require 2 distinct reviewer approvals before onboarding.
    """
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    analysis = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.supplier_id == supplier.supplier_id)
        .order_by(AnalysisResult.generated_at.desc())
        .first()
    )
    risk_level = (analysis.risk_level if analysis else "MEDIUM") or "MEDIUM"

    org = current_user.organization or "GLA Enterprise"
    policy = (
        db.query(PolicyRule)
        .filter(PolicyRule.organization == org, PolicyRule.risk_level == risk_level)
        .first()
    )
    req_approvals = policy.required_approvals if policy else (2 if risk_level == "HIGH" else 1)

    # Count distinct reviewer approvals on this supplier's claims or decisions
    claims = db.query(Claim).filter(Claim.analysis_id == (analysis.analysis_id if analysis else "")).all()
    claim_ids = [c.claim_id for c in claims]

    recorded_actions = (
        db.query(ReviewerAction)
        .filter(ReviewerAction.claim_id.in_(claim_ids), ReviewerAction.action == "APPROVED")
        .all()
    )
    distinct_reviewers = {a.reviewer_id for a in recorded_actions}
    recorded_count = len(distinct_reviewers)

    policy_satisfied = recorded_count >= req_approvals and supplier.status == "VERIFIED"

    return {
        "supplier_id": supplier.supplier_id,
        "risk_level": risk_level,
        "required_approvals": req_approvals,
        "recorded_approvals": recorded_count,
        "reviewers": list(distinct_reviewers),
        "policy_satisfied": policy_satisfied,
        "status": supplier.status,
    }
