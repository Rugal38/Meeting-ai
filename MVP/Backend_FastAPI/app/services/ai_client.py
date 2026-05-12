from pathlib import Path

import httpx

from app.core.config import settings

# 1h recordings can take 30+ minutes end-to-end (transcription + LLM)
_TIMEOUT = httpx.Timeout(timeout=7200.0)


def process_meeting(file_path: Path, content_type: str, file_kind: str = "audio") -> dict:
    """POST the file to the AI service. Routes audio/video to /process and PDF to /process-pdf."""
    if file_kind == "pdf":
        url = f"{settings.ai_service_url}/process-pdf"
    else:
        url = f"{settings.ai_service_url}/process"

    with file_path.open("rb") as f:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(url, files={"file": (file_path.name, f, content_type)})
            response.raise_for_status()
            return response.json()
