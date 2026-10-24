"""
Domain model, rules, and business logic for RESQNET.
Ported logic and state-machine constraints.
"""
from enum import Enum
from typing import Optional, List, Dict, Any


class Role(str, Enum):
    CITIZEN = "Citizen"
    DISPATCHER = "Dispatcher"
    DRONE_OPERATOR = "Drone Operator"
    RESPONDER = "Responder"
    ADMIN = "Admin"


class TransportState(str, Enum):
    DRAFT = "draft"
    SAVED_LOCALLY = "saved_locally"
    PENDING_TRANSMISSION = "pending_transmission"
    RELAY_RECEIVED = "relay_received"
    SERVER_RECEIVED = "server_received"


TRANSPORT_ORDER = [
    TransportState.DRAFT,
    TransportState.SAVED_LOCALLY,
    TransportState.PENDING_TRANSMISSION,
    TransportState.RELAY_RECEIVED,
    TransportState.SERVER_RECEIVED,
]


def validate_transport_transition(current: str, target: str) -> bool:
    try:
        curr_idx = TRANSPORT_ORDER.index(TransportState(current))
        tgt_idx = TRANSPORT_ORDER.index(TransportState(target))
        # Forward only
        return tgt_idx >= curr_idx
    except ValueError:
        return False


class WorkflowState(str, Enum):
    AWAITING_DISPATCHER = "awaiting_dispatcher"
    DISPATCHER_ACKNOWLEDGED = "dispatcher_acknowledged"
    UNDER_REVIEW = "under_review"
    ASSIGNED = "assigned"
    RESPONDER_ACCEPTED = "responder_accepted"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


VALID_WORKFLOW_TRANSITIONS: Dict[str, List[str]] = {
    WorkflowState.AWAITING_DISPATCHER: [
        WorkflowState.DISPATCHER_ACKNOWLEDGED,
        WorkflowState.UNDER_REVIEW,
        WorkflowState.ASSIGNED,
        WorkflowState.CANCELLED,
    ],
    WorkflowState.DISPATCHER_ACKNOWLEDGED: [
        WorkflowState.UNDER_REVIEW,
        WorkflowState.ASSIGNED,
        WorkflowState.CANCELLED,
    ],
    WorkflowState.UNDER_REVIEW: [
        WorkflowState.ASSIGNED,
        WorkflowState.CANCELLED,
    ],
    WorkflowState.ASSIGNED: [
        WorkflowState.RESPONDER_ACCEPTED,
        WorkflowState.CANCELLED,
    ],
    WorkflowState.RESPONDER_ACCEPTED: [
        WorkflowState.IN_PROGRESS,
        WorkflowState.CANCELLED,
    ],
    WorkflowState.IN_PROGRESS: [
        WorkflowState.RESOLVED,
        WorkflowState.CANCELLED,
    ],
    WorkflowState.RESOLVED: [],  # terminal
    WorkflowState.CANCELLED: [],  # terminal
}


def validate_workflow_transition(current: str, target: str) -> bool:
    if current == target:
        return True
    allowed = VALID_WORKFLOW_TRANSITIONS.get(current, [])
    return target in allowed


class DetectionStatus(str, Enum):
    NEW_UNVERIFIED = "new_unverified"
    UNDER_HUMAN_REVIEW = "under_human_review"
    POSSIBLE_PERSON_CONFIRMED = "possible_person_confirmed"
    LINKED_TO_EXISTING_INCIDENT = "linked_to_existing_incident"
    FALSE_POSITIVE = "false_positive"


class NetworkMode(str, Enum):
    NORMAL = "Normal"
    INTERNET_OUTAGE = "Internet Outage"
    RELAY_ONLY = "Relay-Only"
    TOTAL_LOSS = "Total Loss"


UNREVIEWED_DETECTION_LABEL = "Possible person detected, no request linked, pending verification"
SENSOR_ORIGIN_LABEL = "Detected by sensor, not reported by a person"
SENSOR_LIMITATIONS_NOTE = (
    "Sensors may trigger on animals, residual hot surfaces, debris, or thermal obstruction."
)


def get_citizen_status_copy(transport_state: str, workflow_state: str) -> Dict[str, str]:
    """
    Returns exact citizen-facing copy. NEVER includes 'Help is coming'.
    Rule:
    - saved_locally: "Saved on this device — not yet sent"
    - relay_received: "Received by relay — not yet at the response system"
    - server_received + awaiting_dispatcher: "Delivered to response system — awaiting a dispatcher"
    - assigned: "Assigned to a team — awaiting acceptance"
    - responder_accepted: "A responder has accepted this request"
    """
    if transport_state == TransportState.SAVED_LOCALLY:
        return {
            "status_text": "Saved on this device — not yet sent",
            "detail_text": "Your request is stored locally on your device. It will automatically transmit when network connectivity is available.",
            "icon": "device",
        }
    if transport_state == TransportState.PENDING_TRANSMISSION:
        return {
            "status_text": "Transmitting to network...",
            "detail_text": "Attempting to reach response relays or emergency network.",
            "icon": "uploading",
        }
    if transport_state == TransportState.RELAY_RECEIVED:
        return {
            "status_text": "Received by relay — not yet at the response system",
            "detail_text": "A local mesh relay picked up your packet. It will forward to dispatch as soon as the uplink clears.",
            "icon": "relay",
        }

    # If server_received (or beyond)
    if workflow_state == WorkflowState.AWAITING_DISPATCHER:
        return {
            "status_text": "Delivered to response system — awaiting a dispatcher",
            "detail_text": "Your report has reached the central response desk and is queued for verification.",
            "icon": "server",
        }
    if workflow_state in (WorkflowState.DISPATCHER_ACKNOWLEDGED, WorkflowState.UNDER_REVIEW):
        return {
            "status_text": "Under review by dispatch",
            "detail_text": "A dispatcher is currently assessing your report details.",
            "icon": "review",
        }
    if workflow_state == WorkflowState.ASSIGNED:
        return {
            "status_text": "Assigned to a team — awaiting acceptance",
            "detail_text": "A response unit has been allocated and is reviewing the assignment.",
            "icon": "assigned",
        }
    if workflow_state == WorkflowState.RESPONDER_ACCEPTED:
        return {
            "status_text": "A responder has accepted this request",
            "detail_text": "The assigned response unit has acknowledged the task.",
            "icon": "accepted",
        }
    if workflow_state == WorkflowState.IN_PROGRESS:
        return {
            "status_text": "Response team active",
            "detail_text": "The response unit is actively working on this mission.",
            "icon": "in_progress",
        }
    if workflow_state == WorkflowState.RESOLVED:
        return {
            "status_text": "Request resolved",
            "detail_text": "This request has been marked as resolved by response coordination.",
            "icon": "resolved",
        }
    if workflow_state == WorkflowState.CANCELLED:
        return {
            "status_text": "Request cancelled",
            "detail_text": "This request was cancelled.",
            "icon": "cancelled",
        }

    return {
        "status_text": "Request logged",
        "detail_text": "Status: " + workflow_state,
        "icon": "info",
    }


def can_review_detection(role: str, action: str) -> bool:
    """
    Check permission for detection review actions:
    Allowed actions: start, false_positive, rescan, confirm, create_incident
    Drone Operator may start review, mark false positive, request re-scan;
    may NOT confirm, create an incident or assign.
    Only Dispatcher/Admin confirm, create an incident from a detection, assign a team, or resolve.
    """
    if role in (Role.ADMIN, Role.DISPATCHER):
        return action in ["start", "false_positive", "rescan", "confirm", "create_incident"]

    if role == Role.DRONE_OPERATOR:
        return action in ["start", "false_positive", "rescan"]

    return False


def can_assign_team(role: str) -> bool:
    return role in (Role.ADMIN, Role.DISPATCHER)


def can_resolve_incident(role: str) -> bool:
    return role in (Role.ADMIN, Role.DISPATCHER, Role.RESPONDER)


def can_accept_assignment(role: str) -> bool:
    return role in (Role.ADMIN, Role.RESPONDER)
