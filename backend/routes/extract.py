import os
import json
import uuid
from datetime import datetime
from typing import Optional, List
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Body
from pydantic import BaseModel

from models.schemas import (
    MeetingExtraction,
    ExtractTextRequest,
    EmailDraftRequest,
    EmailDraftResponse,
    ExtractionHistoryItem
)
from chains.extractor_chain import extract_from_transcript, generate_email_draft
from utils.file_parser import extract_text_from_file

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
HISTORY_FILE = DATA_DIR / "history.json"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_history() -> List[dict]:
    if not HISTORY_FILE.exists():
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_history(items: List[dict]):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Failed to save history: {e}")


def _add_history_entry(source_name: str, source_type: str, extraction: MeetingExtraction) -> ExtractionHistoryItem:
    item = ExtractionHistoryItem(
        id=str(uuid.uuid4()),
        created_at=datetime.utcnow().isoformat(),
        source_name=source_name,
        source_type=source_type,
        extraction=extraction
    )
    history = _load_history()
    history.insert(0, item.model_dump())
    # Keep up to 50 most recent
    _save_history(history[:50])
    return item


SAMPLE_TRANSCRIPTS = {
    "product_sync": """[09:00] Sarah (Product Lead): Good morning everyone. Today we need to lock down our Q4 mobile launch scope. Alex, where do we stand on the push notification service?
[09:02] Alex (Backend Eng): We ran load tests on the notification worker yesterday. Redis throughput was solid at 12k msg/sec, but we saw latency spikes when batch size exceeded 5,000. We agreed in standup to cap batches at 2,500.
[09:04] Sarah: Perfect, let's make that our standard setting. Alex, can you deploy that batch limit to staging by this Thursday?
[09:05] Alex: Yes, I will deploy the configuration update and run a verification pass by Thursday 5 PM.
[09:06] Elena (Design): Quick update on the onboarding flow designs. User testing showed 34% drop-off on screen 3. We decided to combine screens 2 and 3 into a single permission prompt. I'll finalize the Figma prototypes by tomorrow afternoon.
[09:08] Sarah: Awesome decision Elena, that should improve conversion. What about the GDPR data export feature? Is legal review done?
[09:09] Marcus (Compliance/Legal): We are still waiting on counsel feedback regarding EU data residency requirements for third-party analytics. It's an open question whether PostHog self-hosted is sufficient or if we need AWS Frankfurt dedicated DB.
[09:11] Sarah: Let's flag that as an open question. Marcus, could you schedule a 20-min sync with outside counsel by Friday to get clarity?
[09:12] Marcus: Absolutely, on my calendar for Friday morning.
[09:13] Sarah: Decision made: Mobile MVP will launch without third-party analytics if GDPR approval is delayed past Nov 15th. We won't block the mobile release.
[09:15] Sarah: Thanks team! Meeting adjourned."""
}


@router.post("/extract", response_model=ExtractionHistoryItem)
async def extract_meeting(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    title: Optional[str] = Form(None)
):
    """
    Extract decisions, action items, and open questions from an uploaded file (.txt, .docx, .pdf)
    or form text.
    """
    transcript_text = ""
    source_name = "Direct Input"
    source_type = "text"

    if file and file.filename:
        source_name = file.filename
        source_type = "file"
        try:
            content_bytes = await file.read()
            if not content_bytes:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            transcript_text = extract_text_from_file(file.filename, content_bytes)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    elif text and text.strip():
        transcript_text = text.strip()
        source_name = title or "Pasted Transcript"
    else:
        raise HTTPException(
            status_code=400, 
            detail="Please provide a transcript by either uploading a file (.txt, .docx, .pdf) or entering text."
        )

    if not transcript_text.strip():
        raise HTTPException(status_code=400, detail="Transcript content could not be found or is empty.")

    try:
        extraction = extract_from_transcript(transcript_text)
        if title:
            extraction.meeting_title = title
        elif not extraction.meeting_title or extraction.meeting_title == "Meeting Summary & Action Items":
            if file and file.filename:
                base_name = file.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
                extraction.meeting_title = f"{base_name} Summary"
        
        saved_record = _add_history_entry(source_name, source_type, extraction)
        return saved_record
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/extract-json", response_model=ExtractionHistoryItem)
async def extract_meeting_json(payload: ExtractTextRequest):
    """
    JSON endpoint for extracting decisions and action items from raw text.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty.")

    try:
        extraction = extract_from_transcript(payload.text.strip())
        if payload.title:
            extraction.meeting_title = payload.title
        saved_record = _add_history_entry(
            source_name=payload.title or "Pasted Transcript",
            source_type="text",
            extraction=extraction
        )
        return saved_record
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/draft-email", response_model=EmailDraftResponse)
async def draft_email(request: EmailDraftRequest):
    """
    Takes an extraction result and drafts an email follow-up.
    """
    try:
        response = generate_email_draft(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email drafting failed: {str(e)}")


@router.get("/history", response_model=List[ExtractionHistoryItem])
async def get_history():
    """
    Returns saved extraction history.
    """
    return _load_history()


@router.get("/history/{item_id}", response_model=ExtractionHistoryItem)
async def get_history_item(item_id: str):
    history = _load_history()
    for item in history:
        if item.get("id") == item_id:
            return item
    raise HTTPException(status_code=404, detail="Extraction record not found.")


@router.delete("/history/{item_id}")
async def delete_history_item(item_id: str):
    history = _load_history()
    filtered = [item for item in history if item.get("id") != item_id]
    if len(filtered) == len(history):
        raise HTTPException(status_code=404, detail="Item not found.")
    _save_history(filtered)
    return {"status": "success", "message": "Record deleted."}


@router.get("/sample")
async def get_sample():
    """
    Returns a sample transcript for instant testing in the UI.
    """
    return {
        "title": "Mobile Launch & Q4 Engineering Sync",
        "transcript": SAMPLE_TRANSCRIPTS["product_sync"]
    }
