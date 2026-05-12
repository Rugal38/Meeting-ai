from typing import List

CHUNK_TOKEN_LIMIT = 3_000   # words used as token approximation (1 word ≈ 1.3 tokens)
CHUNK_OVERLAP     = 100     # words of overlap between consecutive chunks


def chunk_text(text: str, max_tokens: int = CHUNK_TOKEN_LIMIT, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into word-based chunks with overlap.

    Content shorter than max_tokens is returned as a single-element list.
    """
    words = text.split()

    if len(words) <= max_tokens:
        return [text]

    chunks: List[str] = []
    start = 0
    while start < len(words):
        end = start + max_tokens
        chunks.append(" ".join(words[start:end]))
        if end >= len(words):
            break
        start = end - overlap

    return chunks
