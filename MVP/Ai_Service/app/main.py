import logging
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.routers import transcribe, analysis, tools

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)

app = FastAPI(
    title="MeetingAI — AI Service",
    description="Internal AI service for transcription and analysis. Not publicly exposed.",
    docs_url=None,   # disable Swagger in production; set to '/docs' locally if needed
    redoc_url=None,
)

# Only accept requests from the backend host (localhost in dev)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "backend"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

app.include_router(transcribe.router, prefix="/api", tags=["transcription"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(tools.router, prefix="/api", tags=["tools"])


@app.get("/health", include_in_schema=False)
async def health():
    from app.services.usage_tracker import tracker
    usage = tracker.get_stats()
    return {"status": usage["status"], "groq_usage": usage}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
