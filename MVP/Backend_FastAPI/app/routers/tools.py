import logging
from datetime import date

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.core.usage import get_or_create_usage
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tools", tags=["tools"])

FREE_PDF_DAILY_LIMIT = 3
TOOL_TIMEOUT = 600  # 10 min — enough for large audio/video files


def _check_pdf_limit(user: User, db: Session):
    """For free users: max 3 PDF-to-text per day. Returns Usage row."""
    usage = get_or_create_usage(user, db)
    if user.plan_tier in ("pro", "business"):
        return usage

    today = date.today().isoformat()
    if usage.pdf_tools_date != today:
        usage.pdf_tools_today = 0
        usage.pdf_tools_date = today

    if (usage.pdf_tools_today or 0) >= FREE_PDF_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily limit reached: free users can extract {FREE_PDF_DAILY_LIMIT} PDFs per day. "
                "Upgrade to Pro for unlimited access."
            ),
        )
    return usage


@router.post("/audio-to-text")
@limiter.limit("10/hour")
async def audio_to_text(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("audio/"):
        raise HTTPException(status_code=415, detail="Upload an audio file.")

    content = await file.read()
    if len(content) > 500 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 500 MB.")

    try:
        async with httpx.AsyncClient(timeout=TOOL_TIMEOUT) as client:
            r = await client.post(
                f"{settings.ai_service_url}/transcribe",
                files={"file": (file.filename, content, file.content_type)},
            )
            r.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("AI service transcription error: %s", exc.response.text)
        raise HTTPException(status_code=502, detail="Transcription failed.")
    except Exception as exc:
        logger.error("Audio-to-text error: %s", exc)
        raise HTTPException(status_code=502, detail="Transcription failed.")

    data = r.json()
    return {"text": data.get("text", ""), "language": data.get("language", "")}


@router.post("/video-to-text")
@limiter.limit("10/hour")
async def video_to_text(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=415, detail="Upload a video file.")

    content = await file.read()
    if len(content) > 500 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 500 MB.")

    try:
        async with httpx.AsyncClient(timeout=TOOL_TIMEOUT) as client:
            r = await client.post(
                f"{settings.ai_service_url}/transcribe",
                files={"file": (file.filename, content, file.content_type)},
            )
            r.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("AI service transcription error: %s", exc.response.text)
        raise HTTPException(status_code=502, detail="Transcription failed.")
    except Exception as exc:
        logger.error("Video-to-text error: %s", exc)
        raise HTTPException(status_code=502, detail="Transcription failed.")

    data = r.json()
    return {"text": data.get("text", ""), "language": data.get("language", "")}


@router.post("/pdf-to-text")
@limiter.limit("20/hour")
async def pdf_to_text(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Upload a PDF file.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB.")

    usage = _check_pdf_limit(current_user, db)

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{settings.ai_service_url}/extract-text",
                files={"file": (file.filename, content, "application/pdf")},
            )
            r.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("AI service PDF error: %s", exc.response.text)
        status = exc.response.status_code
        detail = "PDF has no extractable text (may be scanned)." if status == 422 else "Extraction failed."
        raise HTTPException(status_code=status, detail=detail)
    except Exception as exc:
        logger.error("PDF-to-text error: %s", exc)
        raise HTTPException(status_code=502, detail="Extraction failed.")

    # Increment counter for free users
    if current_user.plan_tier not in ("pro", "business"):
        today = date.today().isoformat()
        if usage.pdf_tools_date != today:
            usage.pdf_tools_today = 0
            usage.pdf_tools_date = today
        usage.pdf_tools_today = (usage.pdf_tools_today or 0) + 1
        db.commit()

    data = r.json()
    remaining = None
    if current_user.plan_tier not in ("pro", "business"):
        remaining = FREE_PDF_DAILY_LIMIT - (usage.pdf_tools_today or 0)

    return {
        "text": data.get("text", ""),
        "page_count": data.get("page_count", 0),
        "remaining_today": remaining,
    }


@router.get("/pdf-to-text/status")
def pdf_tool_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns how many PDF extractions the user has left today."""
    if current_user.plan_tier in ("pro", "business"):
        return {"unlimited": True, "remaining_today": None, "limit": None}

    usage = get_or_create_usage(current_user, db)
    today = date.today().isoformat()
    used = (usage.pdf_tools_today or 0) if usage.pdf_tools_date == today else 0
    return {
        "unlimited": False,
        "remaining_today": FREE_PDF_DAILY_LIMIT - used,
        "limit": FREE_PDF_DAILY_LIMIT,
    }


@router.post("/translate-pdf")
@limiter.limit("10/hour")
async def translate_pdf(
    request: Request,
    file: UploadFile = File(...),
    target_language: str = Query("en"),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Upload a PDF file.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB.")

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(
                f"{settings.ai_service_url}/translate",
                files={"file": (file.filename, content, "application/pdf")},
                params={"target_language": target_language},
            )
            r.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("AI service translation error: %s", exc.response.text)
        status = exc.response.status_code
        detail = "PDF has no extractable text." if status == 422 else "Translation failed."
        raise HTTPException(status_code=status, detail=detail)
    except Exception as exc:
        logger.error("Translate-PDF error: %s", exc)
        raise HTTPException(status_code=502, detail="Translation failed.")

    data = r.json()
    return {
        "translated_text": data.get("translated_text", ""),
        "source_language": data.get("source_language", ""),
    }
