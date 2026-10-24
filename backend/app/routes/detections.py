"""
Detection review routes: AI / drone sensor detections queue and human verification pipeline.
"""
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Detection, Incident, AuditEvent
from app.schemas import DetectionResponse, DetectionReviewRequest, IncidentResponse, CitizenStatusCopy
from app.domain import (
    Role,
    DetectionStatus,
    TransportState,
    WorkflowState,
    UNREVIEWED_DETECTION_LABEL,
    SENSOR_ORIGIN_LABEL,
    SENSOR_LIMITATIONS_NOTE,
    can_review_detection,
    get_citizen_status_copy,
)

router = APIRouter(prefix="/api/detections", tags=["detections"])


def enrich_detection(det: Detection) -> DetectionResponse:
    return DetectionResponse(
        id=det.id,
        sensor_source=det.sensor_source,
        grid_block_id=det.grid_block_id,
        lat=det.lat,
        lng=det.lng,
        confidence=det.confidence,
        uncertainty_meters=det.uncertainty_meters,
        status=det.status,
        evidence_preview=det.evidence_preview,
        is_locked=det.is_locked,
        linked_incident_id=det.linked_incident_id,
        corroborating_detection_id=det.corroborating_detection_id,
        reviewed_by_role=det.reviewed_by_role,
        review_notes=det.review_notes,
        simulated=det.simulated,
        unreviewed_label=UNREVIEWED_DETECTION_LABEL,
        sensor_origin_label=SENSOR_ORIGIN_LABEL,
        limitations_note=SENSOR_LIMITATIONS_NOTE,
    )


@router.get("", response_model=List[DetectionResponse])
def get_detections(db: Session = Depends(get_db)):
    detections = db.query(Detection).all()
    return [enrich_detection(d) for d in detections]


@router.get("/{detection_id}", response_model=DetectionResponse)
def get_detection(detection_id: str, db: Session = Depends(get_db)):
    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise HTTPException(status_code=404, detail="Detection not found")
    return enrich_detection(det)


@router.post("/{detection_id}/review")
def review_detection(
    detection_id: str,
    payload: DetectionReviewRequest,
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Dispatcher", alias="X-Demo-Role"),
):
    """
    Action: start | false_positive | rescan | confirm | create_incident
    Drone Operator: start, false_positive, rescan. Forbidden: confirm, create_incident.
    Dispatcher/Admin: all actions.
    """
    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise HTTPException(status_code=404, detail="Detection not found")

    action = payload.action

    # Permission check: Drone Operator may start review, mark false positive, request rescan;
    # may NOT confirm, create incident or assign.
    if not can_review_detection(x_demo_role, action):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{x_demo_role}' is forbidden from performing detection action '{action}'.",
        )

    now = datetime.now(timezone.utc)

    if action == "start":
        det.status = DetectionStatus.UNDER_HUMAN_REVIEW
        det.reviewed_by_role = x_demo_role
        det.is_locked = False  # unlock evidence for inspection
        if payload.review_notes:
            det.review_notes = payload.review_notes

        audit = AuditEvent(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            event_type="detection_review_started",
            entity_type="detection",
            entity_id=det.id,
            actor_role=x_demo_role,
            details=f"Started human review for detection {det.id}",
            timestamp=now,
        )
        db.add(audit)

    elif action == "false_positive":
        det.status = DetectionStatus.FALSE_POSITIVE
        det.reviewed_by_role = x_demo_role
        det.review_notes = payload.review_notes or "Marked as false positive after human inspection."

        audit = AuditEvent(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            event_type="detection_false_positive",
            entity_type="detection",
            entity_id=det.id,
            actor_role=x_demo_role,
            details=f"Detection {det.id} marked as false positive: {det.review_notes}",
            timestamp=now,
        )
        db.add(audit)

    elif action == "rescan":
        det.status = DetectionStatus.UNDER_HUMAN_REVIEW
        det.reviewed_by_role = x_demo_role
        det.review_notes = payload.review_notes or "Requested drone sensor re-scan for corroboration."

        audit = AuditEvent(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            event_type="detection_rescan_requested",
            entity_type="detection",
            entity_id=det.id,
            actor_role=x_demo_role,
            details=f"Re-scan requested for sector {det.grid_block_id} for detection {det.id}",
            timestamp=now,
        )
        db.add(audit)

    elif action == "confirm":
        # Dispatcher corroborates / confirms possible person
        det.status = DetectionStatus.POSSIBLE_PERSON_CONFIRMED
        det.reviewed_by_role = x_demo_role
        det.is_locked = False
        if payload.corroborating_detection_id:
            det.corroborating_detection_id = payload.corroborating_detection_id
        if payload.review_notes:
            det.review_notes = payload.review_notes

        audit = AuditEvent(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            event_type="detection_confirmed",
            entity_type="detection",
            entity_id=det.id,
            actor_role=x_demo_role,
            details=(
                f"Confirmed possible person for {det.id}. "
                + (f"Linked corroborating observation: {payload.corroborating_detection_id}. " if payload.corroborating_detection_id else "")
                + "No automated dispatch."
            ),
            timestamp=now,
        )
        db.add(audit)

    elif action == "create_incident":
        # Rule: No incident from an unreviewed detection.
        # Must be confirmed first (or currently being confirmed)
        if det.status not in (DetectionStatus.POSSIBLE_PERSON_CONFIRMED, DetectionStatus.UNDER_HUMAN_REVIEW):
            raise HTTPException(
                status_code=400,
                detail="Cannot create incident from an unreviewed or unconfirmed detection.",
            )

        # Create new incident from detection
        inc_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
        new_inc = Incident(
            id=inc_id,
            client_request_id=f"det-{det.id}-{uuid.uuid4().hex[:4]}",
            created_at=now,
            server_received_at=now,
            transport_state=TransportState.SERVER_RECEIVED,
            workflow_state=WorkflowState.UNDER_REVIEW,  # Created into review, NEVER automatically dispatched/assigned
            incident_mode="Disaster",
            category="Trapped or stranded",
            grid_block_id=det.grid_block_id,
            location_landmark=f"Sector {det.grid_block_id} (Sensor detection {det.id})",
            people_count="Not sure",
            urgency="high",
            source_type=f"sensor_{det.sensor_source.lower()}",
            notes=f"Created from verified detection {det.id}. Corroboration: {det.corroborating_detection_id or 'none'}. Limitations: {SENSOR_LIMITATIONS_NOTE}",
            assigned_team_id=None,  # Confirming creates incident and NEVER dispatches; assignment is separate
        )
        db.add(new_inc)
        db.flush()

        det.linked_incident_id = new_inc.id
        det.status = DetectionStatus.LINKED_TO_EXISTING_INCIDENT

        audit = AuditEvent(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            event_type="incident_from_detection",
            entity_type="incident",
            entity_id=new_inc.id,
            actor_role=x_demo_role,
            details=f"Created incident {new_inc.id} from confirmed detection {det.id}. Never dispatches automatically.",
            timestamp=now,
        )
        db.add(audit)

    db.commit()
    db.refresh(det)

    resp_data = {"message": f"Detection {det.id} action '{action}' completed.", "detection": enrich_detection(det)}
    if action == "create_incident" and det.linked_incident_id:
        inc = db.query(Incident).filter(Incident.id == det.linked_incident_id).first()
        if inc:
            copy_info = get_citizen_status_copy(inc.transport_state, inc.workflow_state)
            resp_data["incident"] = IncidentResponse(
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

    return resp_data
