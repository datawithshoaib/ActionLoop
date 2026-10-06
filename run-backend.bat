@echo off
echo Starting ActionLoop FastAPI Backend on http://localhost:8000...
cd backend
call venv\Scripts\activate
uvicorn main:app --reload --port 8000
