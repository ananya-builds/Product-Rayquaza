"""
Unit tests for domain logic, state machines, citizen copy gating, and permissions.
"""
import pytest
from app.domain import (
    Role,
    TransportState,
    WorkflowState,
    DetectionStatus,
    validate_transport_transition,
    validate_workflow_transition,
    get_citizen_status_copy,
    can_review_detection,
    can_assign_team,
    can_resolve_incident,
    can_accept_assignment,
    UNREVIEWED_DETECTION_LABEL,
    SENSOR_ORIGIN_LABEL,
)


def test_transport_forward_only():
    # draft -> saved_locally -> pending_transmission -> relay_received -> server_received
    assert validate_transport_transition(TransportState.DRAFT, TransportState.SAVED_LOCALLY) is True
    assert validate_transport_transition(TransportState.SAVED_LOCALLY, TransportState.PENDING_TRANSMISSION) is True
    assert validate_transport_transition(TransportState.PENDING_TRANSMISSION, TransportState.RELAY_RECEIVED) is True
    assert validate_transport_transition(TransportState.RELAY_RECEIVED, TransportState.SERVER_RECEIVED) is True
    assert validate_transport_transition(TransportState.SAVED_LOCALLY, TransportState.SERVER_RECEIVED) is True

    # Backward transitions must fail
    assert validate_transport_transition(TransportState.SERVER_RECEIVED, TransportState.SAVED_LOCALLY) is False
    assert validate_transport_transition(TransportState.RELAY_RECEIVED, TransportState.PENDING_TRANSMISSION) is False
    assert validate_transport_transition(TransportState.PENDING_TRANSMISSION, TransportState.DRAFT) is False


def test_workflow_transitions():
    assert validate_workflow_transition(WorkflowState.AWAITING_DISPATCHER, WorkflowState.DISPATCHER_ACKNOWLEDGED) is True
    assert validate_workflow_transition(WorkflowState.DISPATCHER_ACKNOWLEDGED, WorkflowState.UNDER_REVIEW) is True
    assert validate_workflow_transition(WorkflowState.UNDER_REVIEW, WorkflowState.ASSIGNED) is True
    assert validate_workflow_transition(WorkflowState.ASSIGNED, WorkflowState.RESPONDER_ACCEPTED) is True
    assert validate_workflow_transition(WorkflowState.RESPONDER_ACCEPTED, WorkflowState.IN_PROGRESS) is True
    assert validate_workflow_transition(WorkflowState.IN_PROGRESS, WorkflowState.RESOLVED) is True

    # Cancelled is permitted from any non-terminal state
    assert validate_workflow_transition(WorkflowState.AWAITING_DISPATCHER, WorkflowState.CANCELLED) is True
    assert validate_workflow_transition(WorkflowState.IN_PROGRESS, WorkflowState.CANCELLED) is True

    # Terminal state cannot transition
    assert validate_workflow_transition(WorkflowState.RESOLVED, WorkflowState.IN_PROGRESS) is False
    assert validate_workflow_transition(WorkflowState.CANCELLED, WorkflowState.AWAITING_DISPATCHER) is False


def test_citizen_copy_gating():
    # 1. saved_locally: "Saved on this device — not yet sent"
    copy_local = get_citizen_status_copy(TransportState.SAVED_LOCALLY, WorkflowState.AWAITING_DISPATCHER)
    assert copy_local["status_text"] == "Saved on this device — not yet sent"

    # 2. relay_received: "Received by relay — not yet at the response system"
    copy_relay = get_citizen_status_copy(TransportState.RELAY_RECEIVED, WorkflowState.AWAITING_DISPATCHER)
    assert copy_relay["status_text"] == "Received by relay — not yet at the response system"

    # 3. server_received + awaiting_dispatcher: "Delivered to response system — awaiting a dispatcher"
    copy_server = get_citizen_status_copy(TransportState.SERVER_RECEIVED, WorkflowState.AWAITING_DISPATCHER)
    assert copy_server["status_text"] == "Delivered to response system — awaiting a dispatcher"

    # 4. assigned: "Assigned to a team — awaiting acceptance"
    copy_assigned = get_citizen_status_copy(TransportState.SERVER_RECEIVED, WorkflowState.ASSIGNED)
    assert copy_assigned["status_text"] == "Assigned to a team — awaiting acceptance"

    # 5. only after responder_accepted: "A responder has accepted this request"
    copy_accepted = get_citizen_status_copy(TransportState.SERVER_RECEIVED, WorkflowState.RESPONDER_ACCEPTED)
    assert copy_accepted["status_text"] == "A responder has accepted this request"

    # CRITICAL RULE: Never show "Help is coming" across ANY state
    for t_state in TransportState:
        for w_state in WorkflowState:
            copy_res = get_citizen_status_copy(t_state.value, w_state.value)
            full_text = f"{copy_res['status_text']} {copy_res.get('detail_text', '')}".lower()
            assert "help is coming" not in full_text


def test_detection_permission_matrix():
    # Drone Operator permissions
    assert can_review_detection(Role.DRONE_OPERATOR, "start") is True
    assert can_review_detection(Role.DRONE_OPERATOR, "false_positive") is True
    assert can_review_detection(Role.DRONE_OPERATOR, "rescan") is True
    # Drone Operator FORBIDDEN to confirm, create_incident, assign
    assert can_review_detection(Role.DRONE_OPERATOR, "confirm") is False
    assert can_review_detection(Role.DRONE_OPERATOR, "create_incident") is False
    assert can_assign_team(Role.DRONE_OPERATOR) is False

    # Dispatcher and Admin permissions
    assert can_review_detection(Role.DISPATCHER, "confirm") is True
    assert can_review_detection(Role.DISPATCHER, "create_incident") is True
    assert can_assign_team(Role.DISPATCHER) is True
    assert can_resolve_incident(Role.DISPATCHER) is True

    assert can_review_detection(Role.ADMIN, "confirm") is True
    assert can_review_detection(Role.ADMIN, "create_incident") is True
    assert can_assign_team(Role.ADMIN) is True

    # Responder permissions
    assert can_accept_assignment(Role.RESPONDER) is True
    assert can_resolve_incident(Role.RESPONDER) is True
    assert can_assign_team(Role.RESPONDER) is False
