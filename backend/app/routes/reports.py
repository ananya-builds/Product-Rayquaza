"""
Call log / Reports routes.
"""
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Report, AuditEvent
from app.schemas import ReportCreate, ReportResponse

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("", response_model=ReportResponse)
def create_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Dispatcher", alias="X-Demo-Role"),
):
    now = datetime.now(timezone.utc)
    rep_id = f"REP-{uuid.uuid4().hex[:6].upper()}"

    report = Report(
        id=rep_id,
        caller_notes=payload.caller_notes,
        caller_location=payload.caller_location,
        caller_phone=payload.caller_phone,
        time=now,
        created_at=now,
        dispatcher_role=x_demo_role,
        incident_id=payload.incident_id,
    )
    db.add(report)

    audit = AuditEvent(
        id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        event_type="call_logged",
        entity_type="report",
        entity_id=rep_id,
        actor_role=x_demo_role,
        details=f"Dispatcher logged emergency call: '{payload.caller_notes[:50]}...'",
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(report)
    return report


@router.get("", response_model=List[ReportResponse])
def get_reports(
    incident_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Report)
    if incident_id:
        query = query.filter(Report.incident_id == incident_id)
    return query.order_by(Report.time.desc()).all()
