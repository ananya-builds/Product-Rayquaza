"""
Grid blocks route: 12-block sector grid A1-C4.
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import GridBlock
from app.schemas import GridBlockResponse

router = APIRouter(prefix="/api/grid-blocks", tags=["grid"])


@router.get("", response_model=List[GridBlockResponse])
def get_grid_blocks(db: Session = Depends(get_db)):
    blocks = db.query(GridBlock).all()
    return blocks
