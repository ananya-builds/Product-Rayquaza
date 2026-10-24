"""
Demo control routes: Network outage simulation, drone survey simulation, and reset.
"""
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DemoState, AuditEvent, Drone, Detection
from app.schemas import NetworkModeRequest
from app.domain import NetworkMode, DetectionStatus
from app.seed import seed_database

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/state")
def get_demo_state(db: Session = Depends(get_db)):
    state = db.query(DemoState).filter(DemoState.id == "default").first()
    if not state:
        state = DemoState(id="default", network_mode=NetworkMode.NORMAL, active_mode="Disaster")
        db.add(state)
        db.commit()
        db.refresh(state)
    return {
        "network_mode": state.network_mode,
        "active_mode": state.active_mode,
        "updated_at": state.updated_at,
    }


@router.post("/network")
def set_network_mode(
    payload: NetworkModeRequest,
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Admin", alias="X-Demo-Role"),
):
    valid_modes = [
        NetworkMode.NORMAL,
        NetworkMode.INTERNET_OUTAGE,
        NetworkMode.RELAY_ONLY,
        NetworkMode.TOTAL_LOSS,
    ]
    if payload.network_mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid network mode: {payload.network_mode}")

    state = db.query(DemoState).filter(DemoState.id == "default").first()
    if not state:
        state = DemoState(id="default", network_mode=payload.network_mode, active_mode="Disaster")
        db.add(state)
    else:
        state.network_mode = payload.network_mode
        state.updated_at = datetime.now(timezone.utc)

    audit = AuditEvent(
        id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        event_type="network_mode_changed",
        entity_type="network",
        entity_id="mesh_gateway",
        actor_role=x_demo_role,
        details=f"Demo network mode changed to '{payload.network_mode}'",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()

    return {
        "network_mode": state.network_mode,
        "message": f"Simulated network status updated to '{state.network_mode}'",
    }


@router.post("/survey")
def run_drone_survey(
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Drone Operator", alias="X-Demo-Role"),
):
    """
    Simulates running a drone survey flight over sector B4.
    Updates drone status to scanning and generates/refreshes sensor detections DET-001 and DET-002.
    """
    now = datetime.now(timezone.utc)
    drones = db.query(Drone).all()
    for d in drones:
        if d.id in ("DRONE-01", "DRONE-02"):
            d.status = "survey_active"
            d.current_block = "B4"

    # Ensure DET-001 and DET-002 exist in new_unverified state if reset or missing
    det1 = db.query(Detection).filter(Detection.id == "DET-001").first()
    if not det1:
        det1 = Detection(
            id="DET-001",
            sensor_source="Thermal",
            grid_block_id="B4",
            lat=28.6145,
            lng=77.2285,
            confidence=0.84,
            uncertainty_meters=15.0,
            status=DetectionStatus.NEW_UNVERIFIED,
            evidence_preview="thermal_signature_heat_cluster_37c.raw",
            is_locked=True,
            simulated=True,
        )
        db.add(det1)

    det2 = db.query(Detection).filter(Detection.id == "DET-002").first()
    if not det2:
        det2 = Detection(
            id="DET-002",
            sensor_source="Normal Camera",
            grid_block_id="B4",
            lat=28.6148,
            lng=77.2289,
            confidence=0.76,
            uncertainty_meters=18.0,
            status=DetectionStatus.NEW_UNVERIFIED,
            evidence_preview="optical_rgb_debris_periphery.raw",
            is_locked=True,
            simulated=True,
        )
        db.add(det2)

    audit = AuditEvent(
        id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        event_type="survey_executed",
        entity_type="drone",
        entity_id="DRONE-01",
        actor_role=x_demo_role,
        details="Simulated drone survey mission executed over Sector B4. 2 unreviewed sensor anomalies logged.",
        timestamp=now,
    )
    db.add(audit)
    db.commit()

    return {
        "status": "survey_complete",
        "message": "Drone survey completed over Sector B4 (Simulated). Unreviewed sensor signatures available in Detection Review.",
        "detections_count": 2,
    }


@router.post("/reset")
def reset_demo(
    db: Session = Depends(get_db),
    x_demo_role: str = Header(default="Admin", alias="X-Demo-Role"),
):
    """
    Resets the entire prototype back to clean fixtures.
    """
    seed_database(db)
    return {
        "status": "success",
        "message": "Demo state reset successfully. All fixtures re-seeded.",
    }
