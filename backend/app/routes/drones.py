"""
Drones and Mesh Links routes (Disaster mode simulation).
All drone, sensor, and mesh features are strictly simulated.
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Drone, MeshLink, Team
from app.schemas import DroneResponse, MeshLinkResponse, TeamResponse

router = APIRouter(prefix="/api", tags=["drones-and-mesh"])


@router.get("/drones", response_model=List[DroneResponse])
def get_drones(db: Session = Depends(get_db)):
    return db.query(Drone).all()


@router.get("/mesh-links", response_model=List[MeshLinkResponse])
def get_mesh_links(db: Session = Depends(get_db)):
    return db.query(MeshLink).all()


@router.get("/teams", response_model=List[TeamResponse])
def get_teams(db: Session = Depends(get_db)):
    return db.query(Team).all()
