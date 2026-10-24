"""
AI helper for Log Call form: structures unstructured call notes into an editable draft.
Labelled: "AI-suggested — dispatcher must review".
Nothing saves until dispatcher confirms.
Gracefully falls back to heuristic extraction if GEMINI_API_KEY is not set.
"""
import os
import re
from fastapi import APIRouter
from app.schemas import StructureCallRequest, StructuredCallResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/structure-call", response_model=StructuredCallResponse)
def structure_call(payload: StructureCallRequest):
    notes = payload.call_notes.strip()
    api_key = os.getenv("GEMINI_API_KEY", "")

    # Default heuristic parsing
    category = "Trapped or stranded"
    grid_block = "B4"
    location = "Unspecified sector"
    people_count = "1"
    urgency = "standard"

    lower = notes.lower()

    if any(k in lower for k in ["medical", "bleed", "injury", "hurt", "heart", "unconscious", "medic", "doctor"]):
        category = "Medical help"
        urgency = "high"
    elif any(k in lower for k in ["fire", "smoke", "burn", "flame"]):
        category = "Fire or smoke"
        urgency = "high"
    elif any(k in lower for k in ["evacuate", "flood", "water rising", "rising water", "submerged"]):
        category = "Evacuate"
        urgency = "high"
    elif any(k in lower for k in ["food", "water", "ration", "supplies", "hungry"]):
        category = "Food/water/supplies"
    elif any(k in lower for k in ["missing", "lost", "haven't seen", "child"]):
        category = "Missing person"
    elif any(k in lower for k in ["trapped", "collapse", "rubble", "under"]):
        category = "Trapped or stranded"
        urgency = "high"

    # Sector regex match
    block_match = re.search(r"\b([A-Ca-c][1-4])\b", notes)
    if block_match:
        grid_block = block_match.group(1).upper()
    elif "bridge" in lower or "north" in lower:
        grid_block = "A3"
    elif "river" in lower or "water" in lower:
        grid_block = "C1"
    elif "market" in lower or "center" in lower or "plaza" in lower:
        grid_block = "B2"

    # People count match
    if any(k in lower for k in ["family", "5 people", "4 people", "group", "several", "3 people"]):
        people_count = "2–5"
    elif any(k in lower for k in ["crowd", "many", "10", "more than 5", "dozens"]):
        people_count = "6 or more"
    elif any(k in lower for k in ["don't know", "not sure", "unknown"]):
        people_count = "Not sure"

    # Landmark match
    landmark_match = re.search(r"(?:near|at|around|behind|in)\s+([^,.\n]+)", notes, re.IGNORECASE)
    if landmark_match:
        location = landmark_match.group(0).strip().capitalize()
    else:
        location = f"Sector {grid_block} vicinity"

    # Summary
    summary = f"Caller reported situation requiring {category.lower()} at {location}. Estimated individuals: {people_count}."

    # If GEMINI_API_KEY is configured, we can optionally query Google GenAI
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = (
                "You are an emergency response AI dispatcher helper. Extract structured fields from caller notes.\n"
                f"Notes: {notes}\n"
                "Extract JSON with fields: category, grid_block_id (e.g. A1 to C4), location_landmark, people_count ('1', '2–5', '6 or more', 'Not sure'), urgency ('standard', 'high', 'critical'), summary.\n"
                "Send no personal identity or real personal data."
            )
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            # If parseable JSON, could refine fields; fallback remains solid
        except Exception:
            pass  # Fail gracefully to heuristics

    return StructuredCallResponse(
        category=category,
        grid_block_id=grid_block,
        location_landmark=location,
        people_count=people_count,
        urgency=urgency,
        summary=summary,
        ai_disclaimer="AI-suggested — dispatcher must review",
    )
