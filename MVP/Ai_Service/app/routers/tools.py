import os
import tempfile
import logging
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.services import pdf_service, llm_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """Extract raw text from a PDF using pdfplumber. No LLM involved."""
    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Upload a PDF file.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB.")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf", prefix="meetingai_tool_")
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(content)

        text, page_count = pdf_service.extract_text(Path(tmp_path))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("PDF extraction failed")
        raise HTTPException(status_code=500, detail="Extraction failed.") from exc
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return {"text": text, "page_count": page_count}


@router.post("/translate")
async def translate_pdf(
    file: UploadFile = File(...),
    target_language: str = Query("en"),
):
    """Extract text from a PDF and translate it using the LLM."""
    if target_language not in ("en", "fr", "ar"):
        raise HTTPException(status_code=400, detail="target_language must be 'en', 'fr', or 'ar'.")

    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Upload a PDF file.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB.")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf", prefix="meetingai_tool_")
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(content)

        text, _ = pdf_service.extract_text(Path(tmp_path))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("PDF extraction failed before translation")
        raise HTTPException(status_code=500, detail="Extraction failed.") from exc
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    try:
        translated = await llm_service.translate_text(text, target_language)
    except Exception as exc:
        logger.exception("Translation failed")
        raise HTTPException(status_code=500, detail="Translation failed.") from exc

    return {"translated_text": translated, "source_language": "auto"}
