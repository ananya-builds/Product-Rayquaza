"""
RESQNET FastAPI Main Application.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, SessionLocal
from app.seed import seed_database
from app.models import GridBlock
from app.routes import (
    sync,
    incidents,
    reports,
    detections,
    grid,
    drones,
    shelters,
    audit,
    demo,
    ai,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    init_db()
    # Check if database needs initial seeding
    db = SessionLocal()
    try:
        first_block = db.query(GridBlock).first()
        if not first_block:
            seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="RESQNET Emergency Response Mesh API",
    version="1.0.0",
    description="Offline-first dual-mode emergency response prototype with drone sensor verification and resilient sync.",
    lifespan=lifespan,
)

# CORS middleware for local frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sync.router)
app.include_router(incidents.router)
app.include_router(reports.router)
app.include_router(detections.router)
app.include_router(grid.router)
app.include_router(drones.router)
app.include_router(shelters.router)
app.include_router(audit.router)
app.include_router(demo.router)
app.include_router(ai.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "RESQNET"}
