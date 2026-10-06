"""
LangGraph workflow for multi-step processing:
1. Extract items from transcript
2. Validate and refine extraction
3. (Optional) Auto-draft follow-up email
"""
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from models.schemas import MeetingExtraction, EmailDraftRequest, EmailDraftResponse
from chains.extractor_chain import extract_from_transcript, generate_email_draft


class MeetingState(TypedDict):
    raw_transcript: str
    extraction: Optional[MeetingExtraction]
    email_draft: Optional[EmailDraftResponse]
    error: Optional[str]


def extract_node(state: MeetingState) -> MeetingState:
    try:
        extraction = extract_from_transcript(state["raw_transcript"])
        return {**state, "extraction": extraction, "error": None}
    except Exception as e:
        return {**state, "error": str(e)}


def draft_email_node(state: MeetingState) -> MeetingState:
    if not state.get("extraction"):
        return state
    try:
        req = EmailDraftRequest(
            meeting_title=state["extraction"].meeting_title,
            meeting_summary=state["extraction"].meeting_summary,
            decisions=state["extraction"].decisions,
            action_items=state["extraction"].action_items,
            open_questions=state["extraction"].open_questions
        )
        email_draft = generate_email_draft(req)
        return {**state, "email_draft": email_draft}
    except Exception as e:
        return {**state, "error": str(e)}


def build_workflow():
    workflow = StateGraph(MeetingState)
    workflow.add_node("extract", extract_node)
    workflow.add_node("draft_email", draft_email_node)
    
    workflow.set_entry_point("extract")
    workflow.add_edge("extract", "draft_email")
    workflow.add_edge("draft_email", END)
    
    return workflow.compile()


meeting_app_graph = build_workflow()
