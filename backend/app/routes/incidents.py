"""
Incident routes: querying, status updates, team assignments, and linking reports.
"""
from datetime import datetime, timezone
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Incident, Report, Team, Assignment, AuditEvent
from app.schemas import (
    IncidentResponse,
    IncidentUpdate,
    AssignmentCreate,
    AssignmentResponse,
    LinkReportRequest,
    CitizenStatusCopy,
)
from app.domain import (
    Role,
    WorkflowState,
    get_citizen_status_copy,
    validate_workflow_transition,
    can_assign_team,
    can_resolve_incident,
    can_accept_assignment,
)

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def enrich_incident_response(inc: Incident) -> IncidentResponse:
    copy_info = get_citizen_status_copy(inc.transport_state, inc.workflow_state)
    return IncidentResponse(
        id=inc.id,
        client_request_id=inc.client_request_id,
        created_at=inc.created_at,
        server_received_at=inc.server_received_at,
        transport_state=inc.transport_state,
        workflow_state=inc.workflow_state,
        incident_mode=inc.incident_mode,
        category=inc.category,
        grid_block_id=inc.grid_block_id,
        location_landmark=inc.location_landmark,
        people_count=inc.people_count,
        urgency=inc.urgency,
        source_type=inc.source_type,
        notes=inc.notes,
        assigned_team_id=inc.assigned_team_id,
        assigned_team=inc.assigned_team,
        citizen_copy=CitizenStatusCopy(**copy_info),
    )


@router.get("", response_model=List[IncidentResponse])
def get_incidents(
    mode: Optional[str] = Query(None, description="Everyday or Disaster"),
    workflow_state: Optional[str] = Query(None),
    grid_block_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Incident)
    if mode:
        query = query.filter(Incident.incident_mode == mode)
    if workflow_state:
        query = query.filter(Incident.workflow_state == workflow_state)
    if grid_block_id:
        query = query.filter(Incident.grid_block_id == grid_block_id)
        
    incidents = query.order_by(Incident.created_at.desc()).all()
    return [enrich_incident_response(inc) for inc in incidents]


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return enrich_incident_response(inc)


@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Dispatcher", alias="X-Demo-Role"),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    now = datetime.now(timezone.utc)

    # Workflow state changes
    if payload.workflow_state and payload.workflow_state != inc.workflow_state:
        target = payload.workflow_state
        if not validate_workflow_transition(inc.workflow_state, target):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid state transition from '{inc.workflow_state}' to '{target}'.",
            )

        # Role checks
        if target == WorkflowState.RESOLVED:
            if not can_resolve_incident(x_demo_role):
                raise HTTPException(status_code=403, detail="Role not authorized to resolve incidents")
        elif target == WorkflowState.RESPONDER_ACCEPTED:
            if not can_accept_assignment(x_demo_role):
                raise HTTPException(status_code=403, detail="Role not authorized to accept response assignments")
        elif target in (WorkflowState.ASSIGNED, WorkflowState.UNDER_REVIEW, WorkflowState.DISPATCHER_ACKNOWLEDGED):
            if x_demo_role not in (Role.DISPATCHER, Role.ADMIN):
                raise HTTPException(status_code=403, detail="Role not authorized for dispatcher actions")

        old_state = inc.workflow_state
        inc.workflow_state = target

        # If resolved, release any assigned team
        if target == WorkflowState.RESOLVED and inc.assigned_team_id:
            team = db.query(Team).filter(Team.id == inc.assigned_team_id).first()
            if team:
                team.status = "available"
                team.active_incident_id = None

        audit = AuditEvent(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            event_type="workflow_update",
            entity_type="incident",
            entity_id=inc.id,
            actor_role=x_demo_role,
            details=f"Workflow transitioned from '{old_state}' to '{target}'",
            timestamp=now,
        )
        db.add(audit)

    if payload.notes is not None:
        inc.notes = payload.notes
    if payload.urgency is not None:
        inc.urgency = payload.urgency

    db.commit()
    db.refresh(inc)
    return enrich_incident_response(inc)


@router.post("/{incident_id}/assignments", response_model=AssignmentResponse)
def assign_team_to_incident(
    incident_id: str,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Dispatcher", alias="X-Demo-Role"),
):
    # Rule: Drone Operator cannot assign
    if not can_assign_team(x_demo_role):
        raise HTTPException(
            status_code=403,
            detail=f"Role '{x_demo_role}' is forbidden from assigning teams.",
        )

    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    now = datetime.now(timezone.utc)
    assignment_id = f"ASG-{uuid.uuid4().hex[:6].upper()}"

    assignment = Assignment(
        id=assignment_id,
        incident_id=inc.id,
        team_id=team.id,
        assigned_by_role=x_demo_role,
        assigned_at=now,
        status="pending_acceptance",
    )
    db.add(assignment)

    # Update incident state to assigned
    inc.assigned_team_id = team.id
    inc.workflow_state = WorkflowState.ASSIGNED
    
    # Update team status
    team.status = "assigned"
    team.active_incident_id = inc.id

    audit = AuditEvent(
        id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        event_type="assignment",
        entity_type="incident",
        entity_id=inc.id,
        actor_role=x_demo_role,
        details=f"Assigned team '{team.name}' ({team.id}) to incident {inc.id}",
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/{incident_id}/link-report")
def link_report_to_incident(
    incident_id: str,
    payload: LinkReportRequest,
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Dispatcher", alias="X-Demo-Role"),
):
    if x_demo_role not in (Role.DISPATCHER, Role.ADMIN):
        raise HTTPException(status_code=403, detail="Role not authorized to link reports")

    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    rep = db.query(Report).filter(Report.id == payload.report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found")

    rep.incident_id = inc.id

    audit = AuditEvent(
        id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        event_type="link_report",
        entity_type="incident",
        entity_id=inc.id,
        actor_role=x_demo_role,
        details=f"Linked call report {rep.id} to incident {inc.id}",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()

    return {"message": f"Report {rep.id} linked to incident {inc.id}"}
