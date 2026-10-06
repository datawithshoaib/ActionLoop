# ActionLoop

**Turn meeting transcripts into structured action items — automatically.**

ActionLoop extracts decisions, action items, and owners from a raw meeting transcript (uploaded file or pasted text) and returns a clean, structured table. It can also auto-draft a follow-up email summarizing the meeting.

---

## Problem It Solves

People forget to follow up on commitments made in meetings. Manually re-reading transcripts or notes to extract "who owes what" is tedious and error-prone. This tool automates that extraction into a structured, actionable format.

---

## Core Features

- Upload a transcript file (`.txt`, `.docx`, `.pdf`) or paste raw notes
- Extract structured output:
  - Decisions made
  - Action items (task, owner, due date if mentioned, priority)
  - Open questions / unresolved topics
- Auto-generate a follow-up email draft summarizing the meeting
- Export results as CSV / copy to clipboard
- Simple session history (view past extractions)

---

## Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI** — REST API layer
- **LangChain** — orchestration, prompt templates, structured output parsing
- **LangGraph** (optional, for v2) — if you want a multi-step graph (extract → validate → draft email) instead of a single chain
- **Pydantic v2** — structured output schemas (forces the LLM to return clean JSON matching your data model)
- **Uvicorn** — ASGI server
- **python-multipart** — for file uploads in FastAPI
- **python-docx** — reading `.docx` transcripts
- **pypdf** — reading `.pdf` transcripts
- **python-dotenv** — environment variable management

### LLM Provider
- **Groq** — via `langchain-groq` (LangChain's native Groq integration). Groq offers fast inference on open models like Llama 3.3, Mixtral, and Gemma

### Frontend
- **Next.js 14+ (App Router)**
- **TypeScript**
- **shadcn/ui** — component library (built on Radix UI + Tailwind CSS)
- **Tailwind CSS**
- **React Hook Form** — form handling for text/file input
- **Axios** or native `fetch` — API calls to FastAPI backend
- **Sonner** or shadcn `toast` — notifications
- **react-dropzone** — drag-and-drop file upload UI

### Optional / Nice-to-have
- **SQLite** or **PostgreSQL** (via SQLAlchemy) — persist extraction history
- **Vercel** — frontend hosting
- **Render / Railway / Fly.io** — backend hosting

---

## Installation

### Backend Setup

```bash
# Create project directory
mkdir actionloop-backend && cd actionloop-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn[standard] python-multipart python-dotenv
pip install langchain langchain-groq langchain-core
pip install langgraph              # optional, if using graph-based flow
pip install pydantic
pip install python-docx pypdf
```

Create a `requirements.txt`:

```txt
fastapi
uvicorn[standard]
python-multipart
python-dotenv
langchain
langchain-groq
langchain-core
langgraph
pydantic
python-docx
pypdf
```

Create a `.env` file:

```env
GROQ_API_KEY=your_api_key_here
```

Run the backend:

```bash
uvicorn main:app --reload --port 8000
```

---

### Frontend Setup

```bash
# Create Next.js app
npx create-next-app@latest actionloop-frontend --typescript --tailwind --app

cd actionloop-frontend

# Initialize shadcn/ui
npx shadcn@latest init

# Add commonly needed components
npx shadcn@latest add button card table input textarea toast dialog badge

# Install additional dependencies
npm install axios react-dropzone react-hook-form zod @hookform/resolvers
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run the frontend:

```bash
npm run dev
```

---

## Project Structure

```
actionloop/
├── backend/
│   ├── main.py                 # FastAPI app entrypoint
│   ├── requirements.txt
│   ├── .env
│   ├── models/
│   │   └── schemas.py          # Pydantic models for structured output
│   ├── chains/
│   │   └── extractor_chain.py  # LangChain extraction logic
│   ├── graph/
│   │   └── workflow.py         # LangGraph flow (optional, v2)
│   ├── utils/
│   │   └── file_parser.py      # .docx / .pdf / .txt parsing
│   └── routes/
│       └── extract.py          # API endpoints
│
└── frontend/
    ├── app/
    │   ├── page.tsx             # Main upload/input page
    │   └── results/page.tsx     # Results display page
    ├── components/
    │   ├── upload-form.tsx
    │   ├── results-table.tsx
    │   └── ui/                  # shadcn components
    ├── lib/
    │   └── api.ts               # API call helpers
    └── .env.local
```

---

## Example: Structured Output Schema (Pydantic)

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class ActionItem(BaseModel):
    task: str = Field(description="The specific task to be completed")
    owner: str = Field(description="Person responsible for the task")
    due_date: Optional[str] = Field(default=None, description="Due date if mentioned")
    priority: Optional[str] = Field(default="medium", description="high, medium, or low")

class Decision(BaseModel):
    summary: str = Field(description="What was decided")
    context: Optional[str] = Field(default=None, description="Brief context around the decision")

class MeetingExtraction(BaseModel):
    decisions: List[Decision]
    action_items: List[ActionItem]
    open_questions: List[str]
    meeting_summary: str = Field(description="2-3 sentence summary of the meeting")
```

---

## Example: LangChain Extraction Chain (simplified)

```python
import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from models.schemas import MeetingExtraction

llm = ChatGroq(
    model="llama-3.3-70b-versatile",   # check Groq docs for the latest available model names
    api_key=os.getenv("GROQ_API_KEY")
)
structured_llm = llm.with_structured_output(MeetingExtraction)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You extract decisions, action items, and open questions from meeting transcripts. Be precise and only include what's explicitly stated or clearly implied."),
    ("human", "Transcript:\n\n{transcript}")
])

chain = prompt | structured_llm

def extract_from_transcript(transcript: str) -> MeetingExtraction:
    return chain.invoke({"transcript": transcript})
```

> Check [Groq's model page](https://console.groq.com/docs/models) for the current list of available models, as these are updated periodically.

---

## API Endpoints (planned)

| Method | Endpoint            | Description                                  |
|--------|----------------------|-----------------------------------------------|
| POST   | `/extract`           | Accepts transcript text or file, returns structured extraction |
| POST   | `/draft-email`        | Takes extraction result, returns a drafted follow-up email |
| GET    | `/history`            | Returns past extractions (if persistence added) |

---

## Roadmap

- [ ] v1: Single-chain extraction (transcript → structured JSON)
- [ ] v1: Next.js upload UI + results table
- [ ] v2: LangGraph flow (extract → validate/re-check → draft email) with conditional retry if extraction is incomplete
- [ ] v2: Persist history with SQLite/PostgreSQL
- [ ] v3: Slack/email integration to auto-send follow-up

---

## License

MIT
