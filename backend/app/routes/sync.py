"""
Sync endpoints: batch ingestion with idempotency and network failure simulation.
"""
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models import Incident, AuditEvent, DemoState
from app.schemas import SyncBatchRequest, SyncBatchResponse, IncidentResponse, CitizenStatusCopy
from app.domain import (
    NetworkMode,
    TransportState,
    WorkflowState,
    get_citizen_status_copy,
)

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/batch", response_model=SyncBatchResponse)
def batch_sync(
    payload: SyncBatchRequest,
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Citizen", alias="X-Demo-Role"),
):
    # Check current demo network mode
    demo_state = db.query(DemoState).filter(DemoState.id == "default").first()
    current_net = demo_state.network_mode if demo_state else NetworkMode.NORMAL

    # Rule: In any mode except Normal the server answers /api/sync/batch with 503
    if current_net != NetworkMode.NORMAL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Network unavailable. Current simulated mode: {current_net}. Requests remain queued locally.",
        )

    synced_incidents = []
    
    for item in payload.incidents:
        now = datetime.now(timezone.utc)
        
        # Check idempotency via client_request_id
        existing = None
        if item.client_request_id:
            existing = db.query(Incident).filter(Incident.client_request_id == item.client_request_id).first()
            
        if existing:
            # Replay returns existing incident without creating duplicates
            synced_incidents.append(existing)
            continue

        # Generate new incident ID
        inc_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
        client_created = item.created_at if item.created_at else now

        new_incident = Incident(
            id=inc_id,
            client_request_id=item.client_request_id,
            created_at=client_created,
            server_received_at=now,
            transport_state=TransportState.SERVER_RECEIVED,
            workflow_state=WorkflowState.AWAITING_DISPATCHER,
            incident_mode=item.incident_mode,
            category=item.category,
            grid_block_id=item.grid_block_id or "B4",
            location_landmark=item.location_landmark,
            people_count=item.people_count,
            urgency=item.urgency,
            source_type=item.source_type,
            notes=item.notes,
        )

        try:
            db.add(new_incident)
            db.flush()

            # Audit event for ingest
            audit = AuditEvent(
                id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
                event_type="sync_ingest",
                entity_type="incident",
                entity_id=inc_id,
                actor_role=x_demo_role,
                details=f"Ingested report via sync batch (client_req_id: {item.client_request_id or 'none'})",
                timestamp=now,
            )
            db.add(audit)
            db.commit()
            db.refresh(new_incident)
            synced_incidents.append(new_incident)
        except IntegrityError:
            db.rollback()
            # If a race condition occurred on client_request_id, fetch existing
            if item.client_request_id:
                existing = db.query(Incident).filter(Incident.client_request_id == item.client_request_id).first()
                if existing:
                    synced_incidents.append(existing)

    # Format response with citizen copy
    result = []
    for inc in synced_incidents:
        copy_info = get_citizen_status_copy(inc.transport_state, inc.workflow_state)
        resp_item = IncidentResponse(
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
        result.append(resp_item)

    return SyncBatchResponse(synced_count=len(result), incidents=result)
