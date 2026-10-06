import os
import json
import logging
from typing import Optional
from dotenv import load_dotenv

from models.schemas import MeetingExtraction, Decision, ActionItem, EmailDraftRequest, EmailDraftResponse

load_dotenv()

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert executive assistant and meeting analyst.
Your task is to thoroughly analyze the provided meeting transcript or meeting notes and extract structured information.

Extract:
1. meeting_title: A concise and informative title summarizing the focus of the meeting.
2. meeting_summary: A 2-3 sentence executive summary of what transpired and key outcomes.
3. decisions: All clear decisions made, agreements reached, or directions set during the conversation. Provide brief context where available.
4. action_items: Every commitment, to-do, or task assigned. For each item specify:
   - task: The actionable assignment.
   - owner: Who is responsible (use actual names mentioned, or 'Unassigned' if unspecified).
   - due_date: Due date or timeframe if mentioned, or null.
   - priority: 'high', 'medium', or 'low' based on urgency or explicit deadlines.
5. open_questions: Any unresolved questions, parking lot issues, blockers, or topics flagged for future discussion.

Only extract facts stated or clearly implied in the transcript. Do not fabricate participants or decisions.
"""

EMAIL_SYSTEM_PROMPT = """You are an executive communications assistant.
Draft a concise, professional follow-up email based on the meeting extraction provided.
The email should include:
- A warm opening
- A brief recap of the meeting purpose and summary
- Key decisions made
- Clearly formatted Action Items with owners and deadlines
- Any open questions / next steps
- A polite sign-off
Output formatted as a subject line and email body.
"""

def _get_groq_llm():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        return None
    try:
        from langchain_groq import ChatGroq
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        return ChatGroq(model=model, api_key=api_key, temperature=0.1)
    except Exception as e:
        logger.warning(f"Could not initialize ChatGroq: {e}")
        return None

def _heuristic_fallback_extraction(transcript: str) -> MeetingExtraction:
    """
    Fallback extractor when Groq API key is missing or service is unavailable.
    Parses common patterns or provides structured mock data from the transcript.
    """
    lines = [line.strip() for line in transcript.strip().splitlines() if line.strip()]
    
    # Simple rule-based extraction
    action_items = []
    decisions = []
    open_questions = []
    
    for line in lines:
        lower = line.lower()
        if any(kw in lower for kw in ["todo:", "action:", "action item:", "will do", "take care of", "responsible for"]):
            # attempt splitting task and owner
            parts = line.split(":", 1)
            content = parts[-1].strip() if len(parts) > 1 else line
            action_items.append(
                ActionItem(
                    task=content,
                    owner="Team Member" if "@" not in line else line.split("@")[1].split()[0],
                    priority="high" if any(u in lower for u in ["urgent", "asap", "p0", "priority"]) else "medium"
                )
            )
        elif any(kw in lower for kw in ["decided", "agreed", "decision:", "conclusion"]):
            parts = line.split(":", 1)
            summary = parts[-1].strip() if len(parts) > 1 else line
            decisions.append(Decision(summary=summary, context="Agreed during discussion"))
        elif line.endswith("?") or any(kw in lower for kw in ["question:", "blocker:", "unresolved", "discuss next"]):
            open_questions.append(line.lstrip("-*# ").strip())

    if not action_items:
        action_items = [
            ActionItem(task="Review transcript notes and confirm next milestones", owner="Team", priority="medium")
        ]
    if not decisions:
        decisions = [
            Decision(summary="Proceeded with planned project roadmap", context="Reviewed and confirmed during sync")
        ]

    summary_preview = " ".join(lines[:3]) if lines else "Meeting completed."
    if len(summary_preview) > 200:
        summary_preview = summary_preview[:197] + "..."

    return MeetingExtraction(
        meeting_title="Meeting Sync Notes",
        meeting_summary=f"The team met to review ongoing initiatives. {summary_preview}",
        decisions=decisions,
        action_items=action_items,
        open_questions=open_questions
    )

def extract_from_transcript(transcript: str) -> MeetingExtraction:
    """
    Extracts decisions, action items, and open questions from meeting transcript.
    Uses ChatGroq with structured output if API key is provided, otherwise falls back gracefully.
    """
    if not transcript or not transcript.strip():
        raise ValueError("Transcript content cannot be empty.")

    llm = _get_groq_llm()
    if llm is not None:
        try:
            from langchain_core.prompts import ChatPromptTemplate
            structured_llm = llm.with_structured_output(MeetingExtraction)
            prompt = ChatPromptTemplate.from_messages([
                ("system", SYSTEM_PROMPT),
                ("human", "Here is the meeting transcript:\n\n{transcript}")
            ])
            chain = prompt | structured_llm
            result = chain.invoke({"transcript": transcript})
            if isinstance(result, MeetingExtraction):
                return result
            elif isinstance(result, dict):
                return MeetingExtraction(**result)
        except Exception as e:
            logger.error(f"Error calling Groq extraction chain: {e}. Falling back.")
            # If Groq fails (e.g. rate limit, auth error), fallback
            return _heuristic_fallback_extraction(transcript)

    # If no Groq LLM available, use fallback
    return _heuristic_fallback_extraction(transcript)

def generate_email_draft(req: EmailDraftRequest) -> EmailDraftResponse:
    """
    Generates a follow-up email from meeting extraction data.
    """
    llm = _get_groq_llm()
    if llm is not None:
        try:
            from langchain_core.prompts import ChatPromptTemplate
            from langchain_core.output_parsers import StrOutputParser

            prompt = ChatPromptTemplate.from_messages([
                ("system", EMAIL_SYSTEM_PROMPT),
                ("human", """Meeting Title: {title}
Summary: {summary}
Decisions: {decisions}
Action Items: {action_items}
Open Questions: {open_questions}
Recipient: {recipient}
Sender: {sender}
Tone: {tone}

Please output the email draft in JSON format with two keys: "subject" and "body".""")
            ])
            chain = prompt | llm | StrOutputParser()
            res_str = chain.invoke({
                "title": req.meeting_title or "Project Sync",
                "summary": req.meeting_summary,
                "decisions": "\n".join([f"- {d.summary}" for d in req.decisions]),
                "action_items": "\n".join([f"- {a.task} (Owner: {a.owner}, Due: {a.due_date or 'N/A'}, Priority: {a.priority})" for a in req.action_items]),
                "open_questions": "\n".join([f"- {q}" for q in req.open_questions]),
                "recipient": req.recipient_name or "Team",
                "sender": req.sender_name or "ActionLoop",
                "tone": req.tone or "professional"
            })
            # Try parsing JSON from output
            clean_str = res_str.strip()
            if "```json" in clean_str:
                clean_str = clean_str.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_str:
                clean_str = clean_str.split("```")[1].split("```")[0].strip()
            
            data = json.loads(clean_str)
            return EmailDraftResponse(subject=data.get("subject", f"Follow-up: {req.meeting_title}"), body=data.get("body", clean_str))
        except Exception as e:
            logger.warning(f"Groq email generation fallback due to: {e}")

    # Fallback templated email draft
    subject = f"Follow-up & Action Items: {req.meeting_title or 'Recent Meeting'}"
    
    decisions_list = "\n".join([f"  • {d.summary}" + (f" ({d.context})" if d.context else "") for d in req.decisions]) if req.decisions else "  • No formal decisions recorded."
    
    actions_list = "\n".join([
        f"  • [{a.priority.upper() if a.priority else 'NORMAL'}] {a.task} — @{a.owner}" + (f" (Due: {a.due_date})" if a.due_date else "")
        for a in req.action_items
    ]) if req.action_items else "  • No immediate action items assigned."

    questions_list = "\n".join([f"  • {q}" for q in req.open_questions]) if req.open_questions else "  • None."

    body = f"""Hi {req.recipient_name or 'Team'},

Thanks everyone for taking the time to meet. Here is a recap of our discussion, key decisions, and next steps:

Summary:
{req.meeting_summary}

Decisions Made:
{decisions_list}

Action Items:
{actions_list}

Open Questions / Next Topics:
{questions_list}

Please let me know if anything was missed or requires adjustment.

Best regards,
{req.sender_name or 'Meeting Lead'}"""

    return EmailDraftResponse(subject=subject, body=body)
