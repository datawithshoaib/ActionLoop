import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routes.extract import router as extract_router

load_dotenv()

app = FastAPI(
    title="ActionLoop API",
    description="Turn meeting transcripts into structured action items, decisions, and email drafts.",
    version="1.0.0"
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in dev (e.g. http://localhost:3000)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(extract_router, prefix="", tags=["Extraction"])

@app.get("/")
def root():
    return {
        "name": "ActionLoop API",
        "status": "healthy",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/health")
def health_check():
    groq_configured = bool(os.getenv("GROQ_API_KEY", "").strip())
    return {
        "status": "ok",
        "groq_configured": groq_configured,
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
