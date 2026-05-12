import os
import tempfile
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from app.services import whisper_service, llm_service, ffmpeg_service, chunking_service
from app.services import pdf_service
from app.models.schemas import AnalysisResponse, Segment

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_AV_PREFIXES = ("audio/", "video/")
MAX_AV_BYTES  = 500 * 1024 * 1024   # 500 MB
MAX_PDF_BYTES =  50 * 1024 * 1024   #  50 MB


def _check_content_length(request: Request, limit: int, label: str) -> None:
    """Reject before buffering the full body when Content-Length header is present."""
    cl = request.headers.get("content-length")
    if cl and int(cl) > limit:
        mb = limit // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File too large. {label} files must be ≤ {mb} MB "
                   f"(received ~{int(cl) // (1024 * 1024)} MB).",
        )


@router.post("/process", response_model=AnalysisResponse)
async def process_meeting(request: Request, file: UploadFile = File(...)):
    """Full audio/video pipeline: FFmpeg → Whisper → LLM."""
    content_type = (file.content_type or "").lower()
    if not any(content_type.startswith(p) for p in ALLOWED_AV_PREFIXES):
        raise HTTPException(status_code=415, detail=f"Unsupported media type '{content_type}'.")

    _check_content_length(request, MAX_AV_BYTES, "Audio/video")

    suffix  = _safe_extension(file.filename)
    content = await file.read()
    if len(content) > MAX_AV_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. Audio/video files must be ≤ 500 MB.",
        )

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="meetingai_")
    audio_path = tmp_path

    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(content)
        del content   # free memory before heavy processing

        if content_type.startswith("video/"):
            logger.info("Extracting audio from video…")
            audio_path = await ffmpeg_service.extract_audio(tmp_path)

        logger.info("Starting transcription…")
        transcription = await whisper_service.transcribe(audio_path)
        detected_lang = transcription.get("language", "fr")
        logger.info("Detected language: %s", detected_lang)

        text   = transcription.get("text", "")
        chunks = chunking_service.chunk_text(text)
        logger.info("Analysing %d chunk(s) with LLM…", len(chunks))
        analysis, groq_calls = await _analyze_chunks(chunks, detected_lang)
        logger.info("Job complete — %d Groq call(s) used", groq_calls)

        return AnalysisResponse(
            languePrincipale=detected_lang,
            dureeSecondes=transcription.get("duration", 0),
            transcription=text,
            segments=[Segment(**s) for s in transcription.get("segments", [])],
            resume=analysis.get("resume", ""),
            pointsCles=analysis.get("pointsCles", []),
            conclusions=analysis.get("conclusions", []),
            groqRequestsUsed=groq_calls,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc
    finally:
        for path in {tmp_path, audio_path}:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


@router.post("/process-pdf", response_model=AnalysisResponse)
async def process_pdf(request: Request, file: UploadFile = File(...)):
    """PDF pipeline: pdfplumber text extraction → LLM (no Whisper)."""
    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Expected application/pdf")

    _check_content_length(request, MAX_PDF_BYTES, "PDF")

    content = await file.read()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. PDF files must be ≤ 50 MB.",
        )

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf", prefix="meetingai_")
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(content)
        del content

        try:
            text, page_count = pdf_service.extract_text(Path(tmp_path))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        chunks = chunking_service.chunk_text(text)
        logger.info("PDF: %d pages, %d chunk(s)", page_count, len(chunks))
        analysis, groq_calls = await _analyze_chunks(chunks, "fr")
        logger.info("Job complete — %d Groq call(s) used", groq_calls)

        return AnalysisResponse(
            languePrincipale="pdf",
            dureeSecondes=0,
            transcription=text,
            segments=[],
            resume=analysis.get("resume", ""),
            pointsCles=analysis.get("pointsCles", []),
            conclusions=analysis.get("conclusions", []),
            pageCount=page_count,
            groqRequestsUsed=groq_calls,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"PDF analysis failed: {exc}") from exc
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


# ── Multi-chunk analysis (map-reduce) ────────────────────────────────────────

async def _analyze_chunks(chunks: list[str], language: str) -> tuple[dict, int]:
    """Analyze a list of text chunks. Returns (analysis_result, groq_calls_used).

    Single chunk  → 1 direct LLM call.
    Multiple chunks → N map calls (one per chunk) + 1 reduce call = N+1 total.
    """
    if not chunks:
        return {"resume": "", "pointsCles": [], "conclusions": []}, 0

    if len(chunks) == 1:
        result = await llm_service.analyze_text(chunks[0], language)
        return result, 1

    # Map: extract key points from each chunk independently (N calls)
    n = len(chunks)
    logger.info("Map-reduce: %d chunks → %d map + 1 reduce = %d total Groq calls", n, n, n + 1)
    partial_summaries: list[str] = []
    for i, chunk in enumerate(chunks):
        partial = await llm_service.analyze_text(chunk, language)
        points  = partial.get("pointsCles", [])
        if points:
            partial_summaries.append(
                f"Section {i + 1}:\n" + "\n".join(f"- {p}" for p in points)
            )

    # Reduce: synthesise all partial bullet points into a final analysis (1 call)
    combined = "\n\n".join(partial_summaries) if partial_summaries else " ".join(chunks[0].split()[:500])
    final    = await llm_service.analyze_text(combined, language)

    return final, n + 1


def _safe_extension(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext.isalnum() and len(ext) <= 8:
        return f".{ext}"
    return ""
