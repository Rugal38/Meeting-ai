import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text(file_path: Path) -> tuple[str, int]:
    """Extract text from a PDF file using pdfplumber.

    Returns (full_text, page_count).
    Raises ValueError if pdfplumber cannot extract any text (scanned PDF).
    """
    import pdfplumber  # lazy import — not installed in the default venv

    pages_text: list[str] = []
    page_count = 0

    with pdfplumber.open(str(file_path)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text()
            if text and text.strip():
                pages_text.append(text.strip())

    full_text = "\n\n".join(pages_text)

    if len(full_text.strip()) < 50:
        raise ValueError(
            "No readable text extracted. The PDF may be scanned or image-based. "
            "OCR support is not yet available."
        )

    logger.info("Extracted %d characters from %d PDF pages", len(full_text), page_count)
    return full_text, page_count
