"""
Shelters routes (Simulated relief centers).
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Shelter
from app.schemas import ShelterResponse

router = APIRouter(prefix="/api/shelters", tags=["shelters"])


@router.get("", response_model=List[ShelterResponse])
def get_shelters(db: Session = Depends(get_db)):
    return db.query(Shelter).all()
