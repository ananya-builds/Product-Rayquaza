"""
SQLAlchemy 2.0 database models for RESQNET.
Tables:
- incidents
- reports (logged calls)
- detections
- drones
- mesh_links
- grid_blocks
- shelters
- teams
- assignments
- audit_events
- demo_state
"""
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Idempotency key: client_request_id UNIQUE (nullable)
    client_request_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, index=True, nullable=True)

    # created_at (client time, never overwritten) and server_received_at as separate columns
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    server_received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # transport_state and workflow_state as separate columns
    transport_state: Mapped[str] = mapped_column(String(64), default="server_received")
    workflow_state: Mapped[str] = mapped_column(String(64), default="awaiting_dispatcher")

    # Mode: "Everyday" or "Disaster"
    incident_mode: Mapped[str] = mapped_column(String(32), default="Disaster")
    category: Mapped[str] = mapped_column(String(64))  # Medical, Trapped, etc.
    grid_block_id: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # A1..C4
    location_landmark: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    people_count: Mapped[str] = mapped_column(String(32), default="1")  # "1", "2–5", "6 or more", "Not sure"
    urgency: Mapped[str] = mapped_column(String(32), default="standard")
    source_type: Mapped[str] = mapped_column(String(64), default="citizen_app")  # citizen_app, call_log, detection
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    assigned_team_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("teams.id"), nullable=True)

    # Relationships
    assigned_team = relationship("Team", foreign_keys=[assigned_team_id], lazy="joined")
    reports = relationship("Report", back_populates="incident", cascade="all, delete-orphan")
    detections = relationship("Detection", back_populates="linked_incident")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    caller_notes: Mapped[str] = mapped_column(Text)
    caller_location: Mapped[str] = mapped_column(String(255))
    caller_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    dispatcher_role: Mapped[str] = mapped_column(String(64), default="Dispatcher")
    
    incident_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("incidents.id"), nullable=True)
    incident = relationship("Incident", back_populates="reports")


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # DET-001, DET-002
    sensor_source: Mapped[str] = mapped_column(String(64))  # "Thermal", "Normal Camera", "Both"
    grid_block_id: Mapped[str] = mapped_column(String(16))  # e.g. "B4"
    lat: Mapped[float] = mapped_column(Float, default=28.6139)
    lng: Mapped[float] = mapped_column(Float, default=77.2090)
    confidence: Mapped[float] = mapped_column(Float, default=0.82)
    uncertainty_meters: Mapped[float] = mapped_column(Float, default=15.0)
    
    # Statuses: new_unverified, under_human_review, possible_person_confirmed, linked_to_existing_incident, false_positive
    status: Mapped[str] = mapped_column(String(64), default="new_unverified")
    evidence_preview: Mapped[str] = mapped_column(String(255), default="thermal_signature_heat_anomaly.png")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=True)  # locked evidence preview
    
    # linked_incident_id nullable
    linked_incident_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("incidents.id"), nullable=True)
    corroborating_detection_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    reviewed_by_role: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)

    linked_incident = relationship("Incident", back_populates="detections")


class Drone(Base):
    __tablename__ = "drones"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # DRONE-01
    name: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(64), default="patrolling")  # idle, patrolling, survey
    battery_pct: Mapped[int] = mapped_column(Integer, default=85)
    current_block: Mapped[str] = mapped_column(String(16), default="B4")
    lat: Mapped[float] = mapped_column(Float, default=28.6150)
    lng: Mapped[float] = mapped_column(Float, default=77.2110)
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)


class MeshLink(Base):
    __tablename__ = "mesh_links"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_node: Mapped[str] = mapped_column(String(64))
    target_node: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(64), default="connected")  # connected, weak, disconnected
    signal_quality_dbm: Mapped[int] = mapped_column(Integer, default=-68)
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)


class GridBlock(Base):
    __tablename__ = "grid_blocks"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # A1..C4
    code: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(64))
    risk_level: Mapped[str] = mapped_column(String(32), default="normal")  # normal, caution, high
    bounds: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # [[lat1, lng1], [lat2, lng2]]


class Shelter(Base):
    __tablename__ = "shelters"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    grid_block_id: Mapped[str] = mapped_column(String(16))
    capacity: Mapped[int] = mapped_column(Integer, default=100)
    occupancy: Mapped[int] = mapped_column(Integer, default=45)
    status: Mapped[str] = mapped_column(String(32), default="open")  # open, near_full, closed
    lat: Mapped[float] = mapped_column(Float, default=28.6139)
    lng: Mapped[float] = mapped_column(Float, default=77.2090)
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    team_type: Mapped[str] = mapped_column(String(64), default="Search & Rescue")  # Medical, Search & Rescue, Evacuation
    status: Mapped[str] = mapped_column(String(32), default="available")  # available, assigned, en_route
    current_block: Mapped[str] = mapped_column(String(16), default="B2")
    active_incident_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(64), ForeignKey("incidents.id"))
    team_id: Mapped[str] = mapped_column(String(64), ForeignKey("teams.id"))
    assigned_by_role: Mapped[str] = mapped_column(String(64), default="Dispatcher")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    status: Mapped[str] = mapped_column(String(64), default="pending_acceptance")  # pending_acceptance, accepted, completed


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64))  # review, creation, assignment, resolution, sync, network_change
    entity_type: Mapped[str] = mapped_column(String(64))  # incident, detection, team, network
    entity_id: Mapped[str] = mapped_column(String(64))
    actor_role: Mapped[str] = mapped_column(String(64), default="System")
    details: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DemoState(Base):
    __tablename__ = "demo_state"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default="default")
    network_mode: Mapped[str] = mapped_column(String(64), default="Normal")  # Normal, Internet Outage, Relay-Only, Total Loss
    active_mode: Mapped[str] = mapped_column(String(32), default="Disaster")  # Everyday, Disaster
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
