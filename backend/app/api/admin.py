"""
Admin user management.

- GET   /api/admin/users          : list members (admin only)
- PATCH /api/admin/users/{id}     : change a member's role (admin only)

Role changes are audited and protected: an admin cannot demote the last
active admin, and cannot change their own role (prevents accidental
lockout of the management capability).
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles, validate_role
from app.models.entities import User
from app.services.audit import record_event

router = APIRouter()


class AdminUserResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    organization: str
    created_at: object

    class Config:
        from_attributes = True


class RoleUpdateRequest(BaseModel):
    role: str


@router.get("/users", response_model=List[AdminUserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
):
    """All workspace members with their roles."""
    return db.query(User).order_by(User.created_at).all()


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user_role(
    user_id: str,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
):
    """Change a member's role. The last admin cannot be demoted, and admins
    cannot change their own role (management lockout protection)."""
    new_role = validate_role(payload.role)

    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    if target.user_id == admin.user_id:
        raise HTTPException(
            status_code=409,
            detail="Admins cannot change their own role — ask another admin.",
        )

    if target.role == "admin" and new_role != "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=409,
                detail="Cannot demote the last administrator. Promote another admin first.",
            )

    old_role = target.role
    target.role = new_role
    db.commit()
    db.refresh(target)

    record_event(db, "USER_ROLE_CHANGED", target.user_id, user_id=admin.user_id, details={
        "email": target.email,
        "from": old_role,
        "to": new_role,
    })
    db.commit()
    return target
