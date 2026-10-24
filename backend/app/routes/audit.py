"""
Audit events log route: system immutability and accountability trail.
Every review, creation, assignment, resolution and sync writes an audit event.
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuditEvent
from app.schemas import AuditEventResponse

router = APIRouter(prefix="/api/audit-events", tags=["audit"])


@router.get("", response_model=List[AuditEventResponse])
def get_audit_events(db: Session = Depends(get_db)):
    return db.query(AuditEvent).order_by(AuditEvent.timestamp.desc()).all()
