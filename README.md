# RESQNET — Hackathon Prototype

> **Hackathon prototype. Not connected to emergency services. In immediate danger call your local emergency number.**

Offline-first dual-mode emergency response mesh prototype with citizen request flow, dispatcher queue, drone/sensor detection review, and resilient sync.

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| Docker + Compose | any recent |
| npm | 9+ |

---

### 1. Database (PostgreSQL via Docker)

```bash
docker compose up -d db
```

Wait for `db` to be healthy (about 10 seconds).

---

### 2. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt

# Copy and edit env vars
cp ../.env.example .env

uvicorn app.main:app --reload
```

Server starts at **http://localhost:8000**. Swagger UI: http://localhost:8000/docs

The backend auto-seeds on first start (grid blocks, teams, drones, shelters, detections DET-001 and DET-002).

---

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

App starts at **http://localhost:5173**

---

### 4. Run Tests

```bash
cd backend
pytest
```

All 8 tests should pass (4 domain + 4 API integration, in-memory SQLite — no Docker required).

---

### 5. Build Frontend

```bash
cd frontend
npm run build
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (prod) | PostgreSQL DSN. Defaults to `sqlite:///./resqnet.db` without Docker |
| `GEMINI_API_KEY` | No | Enables AI call-structuring helper. App works fully without it |

---

## Demo Steps (Full Path)

1. **Reset:** Open Admin panel → click **Reset Demo**
2. **Citizen request online:** Switch role → Citizen → Submit a "Trapped or stranded" request in Disaster mode
3. **Dispatcher logs call:** Switch → Dispatcher → Incident Queue → Log Call → link to incident
4. **Internet Outage:** Admin → set network to **Internet Outage**
5. **New request saved locally:** Citizen submits another request — status shows "Saved on this device — not yet sent"
6. **Run drone survey:** Switch → Drone Operator → Drone & Mesh tab → Run Drone Survey (Simulated)
7. **Open DET-001:** Detection Review tab → click DET-001 → Start Review
8. **403 test:** As Drone Operator, try clicking Confirm → blocked (403 shown)
9. **Dispatcher confirms:** Switch → Dispatcher → DET-001 → Confirm Possible Person → link DET-002 as corroborating observation
10. **Create incident:** Dispatcher → DET-001 → Create Incident (workflow_state = under_review, no auto-assign)
11. **Assign team:** Dispatcher → Incident Queue → new incident → Assign Response Team → Confirm dialog
12. **Restore network:** Admin → Normal
13. **Sync now (×2):** Click "Sync Now" twice — second call returns same incident IDs (idempotent replay, no duplicates)
14. **Resolve:** Dispatcher → select incident → Resolve
15. **Audit log:** Audit Trail tab — view full immutable event history

---

## Implemented vs Simulated

| Feature | Status |
|---------|--------|
| Citizen 4-step wizard | ✅ Implemented |
| IndexedDB offline queue (Dexie) | ✅ Implemented |
| Service worker app-shell cache | ✅ Implemented |
| Idempotent batch sync (ON CONFLICT DO NOTHING) | ✅ Implemented |
| Bounded exponential retry | ✅ In client sync logic |
| Dual Everyday/Disaster mode | ✅ Implemented |
| Transport vs Workflow state separation | ✅ Implemented |
| Citizen copy gating (exact wording) | ✅ Implemented + tested |
| Dispatcher queue + incident drawer | ✅ Implemented |
| Log Call form + duplicate link suggestion | ✅ Implemented |
| AI call-structuring (heuristics fallback) | ✅ Implemented (optional Gemini key) |
| Sector map — 12-block grid (A1–C4) | ✅ Leaflet + GeoJSON |
| Shelter display on map | ✅ Simulated |
| Detection review queue | ✅ Implemented (DET-001, DET-002) |
| Drone Operator 403 on confirm/create/assign | ✅ Tested |
| Demo network control (4 modes) | ✅ Implemented |
| Drone & Mesh view | ✅ Simulated |
| Drone survey simulation | ✅ Implemented |
| Audit log | ✅ Implemented |
| PostgreSQL via docker-compose | ✅ Configured |
| SQLite fallback for tests | ✅ Implemented |
| Real GPS / location | ❌ Simulated only |
| Real drone flight commands | ❌ Never — simulated only |
| Real mesh relay hardware | ❌ Simulated only |
| Real facial recognition | ❌ Not implemented (prohibited) |
| WebSockets | ❌ Not implemented (poll every 5s) |
| Real emergency service connection | ❌ Never — hackathon demo only |

---

## Limitations & Honest Notes

- **Demo roles are not real authentication.** The `X-Demo-Role` header is a demo switcher, not a security system. Anyone can set any role header.
- **Drones, sensors, mesh, coverage, and shelters are entirely simulated.** No real hardware is connected.
- **No facial recognition, no identity inference, no age or gender detection** of any kind.
- **Confidence scores are uncalibrated** — they do not represent validated detection accuracy.
- **"Survivor found" is never written** in any UI string or API response.
- **AI helper** requires a Gemini API key in backend `.env`. Without it, heuristic extraction is used and clearly labelled.
- Map tiles are loaded from OpenStreetMap and fail gracefully offline (cached app shell served instead).
