from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid

class ActionItem(BaseModel):
    task: str = Field(description="The specific task to be completed")
    owner: str = Field(description="Person responsible for the task")
    due_date: Optional[str] = Field(default=None, description="Due date if mentioned")
    priority: Optional[str] = Field(default="medium", description="high, medium, or low")

class Decision(BaseModel):
    summary: str = Field(description="What was decided")
    context: Optional[str] = Field(default=None, description="Brief context around the decision")

class MeetingExtraction(BaseModel):
    meeting_title: Optional[str] = Field(default="Meeting Summary & Action Items", description="Descriptive title for the meeting")
    meeting_summary: str = Field(description="2-3 sentence summary of the meeting")
    decisions: List[Decision] = Field(default_factory=list, description="Decisions reached during the meeting")
    action_items: List[ActionItem] = Field(default_factory=list, description="Action items with tasks and owners")
    open_questions: List[str] = Field(default_factory=list, description="Unresolved topics or open questions")

class ExtractTextRequest(BaseModel):
    text: str = Field(..., description="Transcript raw text")
    title: Optional[str] = Field(default=None, description="Optional title or meeting name")

class EmailDraftRequest(BaseModel):
    meeting_title: Optional[str] = "Meeting Follow-up"
    meeting_summary: str
    decisions: List[Decision] = []
    action_items: List[ActionItem] = []
    open_questions: List[str] = []
    recipient_name: Optional[str] = "Team"
    sender_name: Optional[str] = "ActionLoop"
    tone: Optional[str] = "professional"  # professional, concise, casual

class EmailDraftResponse(BaseModel):
    subject: str
    body: str

class ExtractionHistoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    source_name: str
    source_type: str  # "file" or "text"
    extraction: MeetingExtraction
