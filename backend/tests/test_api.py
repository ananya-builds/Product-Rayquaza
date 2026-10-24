"""
Integration tests for RESQNET API handlers and database transactions.
Runs isolated in-memory SQLite without network sockets so tests succeed reliably
in all environments.
"""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, Incident
from app.seed import seed_database
from app.schemas import (
    SyncBatchRequest,
    IncidentCreate,
    IncidentUpdate,
    DetectionReviewRequest,
    AssignmentCreate,
    NetworkModeRequest,
)
from app.routes.sync import batch_sync
from app.routes.incidents import (
    get_incidents,
    get_incident,
    update_incident,
    assign_team_to_incident,
)
from app.routes.detections import review_detection, get_detection
from app.routes.demo import set_network_mode


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    seed_database(session)
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_idempotent_sync_replay(db_session):
    client_id = "req-test-unique-12345"
    payload = SyncBatchRequest(
        incidents=[
            IncidentCreate(
                client_request_id=client_id,
                category="Trapped or stranded",
                grid_block_id="B4",
                location_landmark="Sector B4 North Market",
                people_count="2–5",
                urgency="high",
                source_type="citizen_app",
                notes="Flood waters rising rapidly",
            )
        ]
    )

    # First sync
    res1 = batch_sync(payload, db=db_session, x_demo_role="Citizen")
    assert res1.synced_count == 1
    first_id = res1.incidents[0].id
    assert res1.incidents[0].client_request_id == client_id

    # Second sync (replay of the same batch with same client_request_id)
    res2 = batch_sync(payload, db=db_session, x_demo_role="Citizen")
    assert res2.synced_count == 1
    assert res2.incidents[0].id == first_id

    # Verify database has exactly 1 incident with this client_request_id
    matching = db_session.query(Incident).filter(Incident.client_request_id == client_id).all()
    assert len(matching) == 1


def test_transport_vs_workflow_separation(db_session):
    client_id = "req-separation-99"
    payload = SyncBatchRequest(
        incidents=[
            IncidentCreate(
                client_request_id=client_id,
                category="Medical help",
                grid_block_id="B2",
                location_landmark="Community Hall",
                people_count="1",
                urgency="critical",
            )
        ]
    )
    res = batch_sync(payload, db=db_session, x_demo_role="Citizen")
    inc = res.incidents[0]

    # Verify both separate columns exist in response
    assert inc.transport_state == "server_received"
    assert inc.workflow_state == "awaiting_dispatcher"
    assert inc.created_at is not None
    assert inc.server_received_at is not None
    assert inc.citizen_copy.status_text == "Delivered to response system — awaiting a dispatcher"


def test_detection_permissions_and_workflow(db_session):
    # 1. Drone Operator is forbidden from confirming detection (403)
    with pytest.raises(HTTPException) as exc_confirm:
        review_detection(
            "DET-001",
            DetectionReviewRequest(action="confirm"),
            db=db_session,
            x_demo_role="Drone Operator",
        )
    assert exc_confirm.value.status_code == 403

    # 2. Drone Operator is forbidden from creating incident from detection (403)
    with pytest.raises(HTTPException) as exc_create:
        review_detection(
            "DET-001",
            DetectionReviewRequest(action="create_incident"),
            db=db_session,
            x_demo_role="Drone Operator",
        )
    assert exc_create.value.status_code == 403

    # 3. Drone Operator is permitted to start review
    res_start = review_detection(
        "DET-001",
        DetectionReviewRequest(action="start", review_notes="Drone operator visual check"),
        db=db_session,
        x_demo_role="Drone Operator",
    )
    assert res_start["detection"].status == "under_human_review"

    # 4. No incident from an unreviewed detection
    # DET-002 is still new_unverified
    with pytest.raises(HTTPException) as exc_unreviewed:
        review_detection(
            "DET-002",
            DetectionReviewRequest(action="create_incident"),
            db=db_session,
            x_demo_role="Dispatcher",
        )
    assert exc_unreviewed.value.status_code == 400

    # 5. Dispatcher confirms DET-001, linking DET-002 as corroborating observation
    res_confirm = review_detection(
        "DET-001",
        DetectionReviewRequest(
            action="confirm",
            corroborating_detection_id="DET-002",
            review_notes="Possible person corroborated by optical camera DET-002. No fusion claim.",
        ),
        db=db_session,
        x_demo_role="Dispatcher",
    )
    assert res_confirm["detection"].status == "possible_person_confirmed"

    # 6. Dispatcher creates incident from confirmed detection
    # Rule: Confirming creates an incident and NEVER dispatches/assigns
    res_create = review_detection(
        "DET-001",
        DetectionReviewRequest(action="create_incident"),
        db=db_session,
        x_demo_role="Dispatcher",
    )
    inc_data = res_create["incident"]
    assert inc_data.workflow_state == "under_review"
    assert inc_data.assigned_team_id is None  # Never dispatches automatically!

    # 7. Drone Operator cannot assign a team (403)
    with pytest.raises(HTTPException) as exc_assign:
        assign_team_to_incident(
            inc_data.id,
            AssignmentCreate(team_id="TEAM-2"),
            db=db_session,
            x_demo_role="Drone Operator",
        )
    assert exc_assign.value.status_code == 403

    # 8. Dispatcher assigns team (separate explicit action)
    asg = assign_team_to_incident(
        inc_data.id,
        AssignmentCreate(team_id="TEAM-2"),
        db=db_session,
        x_demo_role="Dispatcher",
    )
    assert asg.status == "pending_acceptance"

    # Check incident now assigned
    inc_check = get_incident(inc_data.id, db=db_session)
    assert inc_check.workflow_state == "assigned"
    assert inc_check.assigned_team_id == "TEAM-2"


def test_network_mode_simulation(db_session):
    # Set network mode to Internet Outage
    res_net = set_network_mode(
        NetworkModeRequest(network_mode="Internet Outage"),
        db=db_session,
        x_demo_role="Admin",
    )
    assert res_net["network_mode"] == "Internet Outage"

    # Sync attempt during outage must return 503
    with pytest.raises(HTTPException) as exc_sync:
        batch_sync(
            SyncBatchRequest(incidents=[IncidentCreate(category="Medical help")]),
            db=db_session,
            x_demo_role="Citizen",
        )
    assert exc_sync.value.status_code == 503

    # Restore to Normal
    set_network_mode(
        NetworkModeRequest(network_mode="Normal"),
        db=db_session,
        x_demo_role="Admin",
    )
    res_sync_ok = batch_sync(
        SyncBatchRequest(incidents=[IncidentCreate(category="Medical help", client_request_id="req-restored-1")]),
        db=db_session,
        x_demo_role="Citizen",
    )
    assert res_sync_ok.synced_count == 1
