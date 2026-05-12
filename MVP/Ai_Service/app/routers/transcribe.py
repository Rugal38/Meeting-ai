import os
import tempfile
import logging

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services import whisper_service

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_MIME_PREFIXES = ("audio/", "video/")
MAX_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    _validate_file(file)

    suffix = _safe_extension(file.filename)

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 500 MB limit.")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="meetingai_")

    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(content)

        result = await whisper_service.transcribe(tmp_path)
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail="Transcription failed. Please try again.") from exc
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _validate_file(file: UploadFile) -> None:
    content_type = (file.content_type or "").lower()
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type '{content_type}'. Upload an audio or video file.",
        )


def _safe_extension(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext.isalnum() and len(ext) <= 8:
        return f".{ext}"
    return ""
