"""
Pydantic v2 schemas for RESQNET API validation and serialization.
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field


class IncidentCreate(BaseModel):
    client_request_id: Optional[str] = None
    created_at: Optional[datetime] = None
    incident_mode: str = "Disaster"
    category: str
    grid_block_id: Optional[str] = "B4"
    location_landmark: Optional[str] = None
    people_count: str = "1"
    urgency: str = "standard"
    source_type: str = "citizen_app"
    notes: Optional[str] = None
    transport_state: str = "server_received"
    workflow_state: str = "awaiting_dispatcher"


class IncidentUpdate(BaseModel):
    workflow_state: Optional[str] = None
    transport_state: Optional[str] = None
    assigned_team_id: Optional[str] = None
    notes: Optional[str] = None
    urgency: Optional[str] = None


class CitizenStatusCopy(BaseModel):
    status_text: str
    detail_text: str
    icon: str


class TeamResponse(BaseModel):
    id: str
    name: str
    team_type: str
    status: str
    current_block: str
    active_incident_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class IncidentResponse(BaseModel):
    id: str
    client_request_id: Optional[str] = None
    created_at: datetime
    server_received_at: datetime
    transport_state: str
    workflow_state: str
    incident_mode: str
    category: str
    grid_block_id: Optional[str] = None
    location_landmark: Optional[str] = None
    people_count: str
    urgency: str
    source_type: str
    notes: Optional[str] = None
    assigned_team_id: Optional[str] = None
    assigned_team: Optional[TeamResponse] = None
    citizen_copy: Optional[CitizenStatusCopy] = None

    model_config = ConfigDict(from_attributes=True)


class ReportCreate(BaseModel):
    caller_notes: str
    caller_location: str
    caller_phone: Optional[str] = None
    incident_id: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    caller_notes: str
    caller_location: str
    caller_phone: Optional[str] = None
    time: datetime
    created_at: datetime
    dispatcher_role: str
    incident_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DetectionReviewRequest(BaseModel):
    action: str  # start | false_positive | rescan | confirm | create_incident
    corroborating_detection_id: Optional[str] = None
    review_notes: Optional[str] = None


class DetectionResponse(BaseModel):
    id: str
    sensor_source: str
    grid_block_id: str
    lat: float
    lng: float
    confidence: float
    uncertainty_meters: float
    status: str
    evidence_preview: str
    is_locked: bool
    linked_incident_id: Optional[str] = None
    corroborating_detection_id: Optional[str] = None
    reviewed_by_role: Optional[str] = None
    review_notes: Optional[str] = None
    simulated: bool
    unreviewed_label: str
    sensor_origin_label: str
    limitations_note: str

    model_config = ConfigDict(from_attributes=True)


class GridBlockResponse(BaseModel):
    id: str
    code: str
    name: str
    risk_level: str
    bounds: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)


class DroneResponse(BaseModel):
    id: str
    name: str
    status: str
    battery_pct: int
    current_block: str
    lat: float
    lng: float
    simulated: bool

    model_config = ConfigDict(from_attributes=True)


class MeshLinkResponse(BaseModel):
    id: str
    source_node: str
    target_node: str
    status: str
    signal_quality_dbm: int
    simulated: bool

    model_config = ConfigDict(from_attributes=True)


class ShelterResponse(BaseModel):
    id: str
    name: str
    grid_block_id: str
    capacity: int
    occupancy: int
    status: str
    lat: float
    lng: float
    simulated: bool

    model_config = ConfigDict(from_attributes=True)


class AssignmentCreate(BaseModel):
    team_id: str


class AssignmentResponse(BaseModel):
    id: str
    incident_id: str
    team_id: str
    assigned_by_role: str
    assigned_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class AuditEventResponse(BaseModel):
    id: str
    event_type: str
    entity_type: str
    entity_id: str
    actor_role: str
    details: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class SyncBatchRequest(BaseModel):
    incidents: List[IncidentCreate]


class SyncBatchResponse(BaseModel):
    synced_count: int
    incidents: List[IncidentResponse]


class NetworkModeRequest(BaseModel):
    network_mode: str  # Normal | Internet Outage | Relay-Only | Total Loss


class LinkReportRequest(BaseModel):
    report_id: str


class StructureCallRequest(BaseModel):
    call_notes: str


class StructuredCallResponse(BaseModel):
    category: str
    grid_block_id: str
    location_landmark: str
    people_count: str
    urgency: str
    summary: str
    ai_disclaimer: str = "AI-suggested — dispatcher must review"
