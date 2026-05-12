import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

MAX_FILE_SIZE     = 500 * 1024 * 1024   # 500 MB (audio/video/text)
MAX_PDF_SIZE      = 50  * 1024 * 1024   # 50 MB  (PDF)
ALLOWED_MIME_PREFIXES = ("audio/", "video/", "text/plain", "application/pdf")
_EXT_RE = re.compile(r"\.[a-z0-9]{1,10}$")


def detect_file_kind(content_type: str) -> str:
    if content_type.startswith("audio/"):
        return "audio"
    if content_type.startswith("video/"):
        return "video"
    if content_type == "application/pdf":
        return "pdf"
    return "text"


def _upload_root() -> Path:
    p = Path(settings.upload_dir).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_file(file: UploadFile) -> tuple[str, str, str, int, str]:
    """Validate and persist an uploaded file.

    Returns (stored_filename, original_filename, mime_type, size_bytes, file_kind).
    """
    content_type = file.content_type or ""
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=400, detail=f"File type not allowed: {content_type}")

    file_kind = detect_file_kind(content_type)
    max_size = MAX_PDF_SIZE if file_kind == "pdf" else MAX_FILE_SIZE

    original_name = file.filename or "upload"
    suffix = Path(original_name).suffix.lower()
    if suffix and not _EXT_RE.match(suffix):
        suffix = ""

    stored_name = f"{uuid.uuid4()}{suffix}"
    root = _upload_root()
    dest = (root / stored_name).resolve()

    if not str(dest).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid file path")

    size = 0
    with dest.open("wb") as out:
        for chunk in iter(lambda: file.file.read(1024 * 1024), b""):
            size += len(chunk)
            if size > max_size:
                dest.unlink(missing_ok=True)
                limit_mb = max_size // (1024 * 1024)
                raise HTTPException(status_code=413, detail=f"File too large (max {limit_mb} MB for {file_kind})")
            out.write(chunk)

    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Empty file")

    return stored_name, original_name, content_type, size, file_kind


def get_path(stored_name: str) -> Path:
    root = _upload_root()
    p = (root / stored_name).resolve()
    if not str(p).startswith(str(root)):
        raise ValueError("Path traversal detected")
    return p


def delete_file(stored_name: str) -> None:
    try:
        get_path(stored_name).unlink(missing_ok=True)
    except ValueError:
        pass
