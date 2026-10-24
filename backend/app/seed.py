"""
Seed fixtures and database reset logic for RESQNET.
Loads initial grid blocks (12 blocks A1-C4), teams, simulated drones, mesh links,
shelters, simulated detections (DET-001, DET-002), and demo state.
"""
from datetime import datetime, timezone
import uuid
from sqlalchemy.orm import Session
from app.models import (
    Base,
    GridBlock,
    Team,
    Drone,
    MeshLink,
    Shelter,
    Detection,
    Incident,
    Report,
    AuditEvent,
    DemoState,
)


def seed_database(db: Session):
    # Clear existing tables for a clean reset
    db.query(AuditEvent).delete()
    db.query(Report).delete()
    db.query(Detection).delete()
    db.query(Incident).delete()
    db.query(Team).delete()
    db.query(Drone).delete()
    db.query(MeshLink).delete()
    db.query(Shelter).delete()
    db.query(GridBlock).delete()
    db.query(DemoState).delete()
    db.commit()

    # 1. Grid Blocks (12 blocks A1-C4)
    # Centered around lat: 28.6139, lng: 77.2090
    rows = ["A", "B", "C"]
    base_lat = 28.6250
    base_lng = 77.1950
    lat_step = 0.0080
    lng_step = 0.0100

    for r_idx, row in enumerate(rows):
        for col in range(1, 5):
            code = f"{row}{col}"
            top_lat = base_lat - (r_idx * lat_step)
            bottom_lat = top_lat - lat_step
            left_lng = base_lng + ((col - 1) * lng_step)
            right_lng = left_lng + lng_step
            
            risk = "normal"
            if code in ["B4", "C4"]:
                risk = "high"
            elif code in ["B3", "A4"]:
                risk = "caution"

            block = GridBlock(
                id=code,
                code=code,
                name=f"Sector {code}",
                risk_level=risk,
                bounds={
                    "north": top_lat,
                    "south": bottom_lat,
                    "west": left_lng,
                    "east": right_lng,
                },
            )
            db.add(block)

    # 2. Teams
    teams = [
        Team(id="TEAM-1", name="Alpha Medical Squad", team_type="Medical", status="available", current_block="B1"),
        Team(id="TEAM-2", name="Bravo Search & Rescue", team_type="Search & Rescue", status="available", current_block="B2"),
        Team(id="TEAM-3", name="Charlie Evacuation Unit", team_type="Evacuation", status="available", current_block="C2"),
        Team(id="TEAM-4", name="Delta Logistics Unit", team_type="Logistics", status="available", current_block="A2"),
    ]
    for t in teams:
        db.add(t)

    # 3. Simulated Drones (3 drones)
    drones = [
        Drone(
            id="DRONE-01",
            name="SkyGuard Alpha (Thermal)",
            status="patrolling",
            battery_pct=88,
            current_block="B4",
            lat=28.6145,
            lng=77.2280,
            simulated=True,
        ),
        Drone(
            id="DRONE-02",
            name="AeroMesh Relay Beta",
            status="patrolling",
            battery_pct=76,
            current_block="B3",
            lat=28.6150,
            lng=77.2180,
            simulated=True,
        ),
        Drone(
            id="DRONE-03",
            name="Scout Gamma (Optical)",
            status="idle",
            battery_pct=94,
            current_block="C4",
            lat=28.6070,
            lng=77.2270,
            simulated=True,
        ),
    ]
    for d in drones:
        db.add(d)

    # 4. Simulated Mesh Links
    mesh_links = [
        MeshLink(id="LINK-01", source_node="DRONE-01", target_node="DRONE-02", status="connected", signal_quality_dbm=-62, simulated=True),
        MeshLink(id="LINK-02", source_node="DRONE-02", target_node="Ground Relay Base", status="connected", signal_quality_dbm=-68, simulated=True),
        MeshLink(id="LINK-03", source_node="DRONE-03", target_node="DRONE-01", status="weak", signal_quality_dbm=-86, simulated=True),
        MeshLink(id="LINK-04", source_node="Auxiliary Relay C4", target_node="DRONE-03", status="disconnected", signal_quality_dbm=-98, simulated=True),
    ]
    for ml in mesh_links:
        db.add(ml)

    # 5. Simulated Shelters
    shelters = [
        Shelter(
            id="SHELTER-01",
            name="Central Community Safehouse",
            grid_block_id="B2",
            capacity=250,
            occupancy=92,
            status="open",
            lat=28.6135,
            lng=77.2085,
            simulated=True,
        ),
        Shelter(
            id="SHELTER-02",
            name="North District High School Camp",
            grid_block_id="A3",
            capacity=400,
            occupancy=360,
            status="open",
            lat=28.6210,
            lng=77.2170,
            simulated=True,
        ),
        Shelter(
            id="SHELTER-03",
            name="East River Relief Staging",
            grid_block_id="C1",
            capacity=150,
            occupancy=146,
            status="near_full",
            lat=28.6050,
            lng=77.1980,
            simulated=True,
        ),
    ]
    for s in shelters:
        db.add(s)

    # 6. Detections (DET-001 thermal B4, DET-002 camera B4 - unreviewed fixtures, no linked request)
    det1 = Detection(
        id="DET-001",
        sensor_source="Thermal",
        grid_block_id="B4",
        lat=28.6145,
        lng=77.2285,
        confidence=0.84,
        uncertainty_meters=15.0,
        status="new_unverified",
        evidence_preview="thermal_signature_heat_cluster_37c.raw",
        is_locked=True,
        linked_incident_id=None,
        corroborating_detection_id=None,
        reviewed_by_role=None,
        review_notes=None,
        simulated=True,
    )
    det2 = Detection(
        id="DET-002",
        sensor_source="Normal Camera",
        grid_block_id="B4",
        lat=28.6148,
        lng=77.2289,
        confidence=0.76,
        uncertainty_meters=18.0,
        status="new_unverified",
        evidence_preview="optical_rgb_debris_periphery.raw",
        is_locked=True,
        linked_incident_id=None,
        corroborating_detection_id=None,
        reviewed_by_role=None,
        review_notes=None,
        simulated=True,
    )
    db.add(det1)
    db.add(det2)

    # 7. Demo State
    demo_state = DemoState(
        id="default",
        network_mode="Normal",
        active_mode="Disaster",
        updated_at=datetime.now(timezone.utc),
    )
    db.add(demo_state)

    # 8. Initial audit event
    audit = AuditEvent(
        id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        event_type="system_init",
        entity_type="demo",
        entity_id="system",
        actor_role="System",
        details="Demo fixtures loaded and reset to clean baseline",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
