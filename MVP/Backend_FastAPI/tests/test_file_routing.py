"""Tests for file type detection and routing logic."""
import os

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("STRIPE_SECRET_KEY", "")

from app.services.file_storage import detect_file_kind, ALLOWED_MIME_PREFIXES, MAX_FILE_SIZE, MAX_PDF_SIZE


# ── MIME detection ────────────────────────────────────────────────────────────

class TestDetectFileKind:

    @pytest.mark.parametrize("mime,expected", [
        ("audio/mpeg",           "audio"),
        ("audio/wav",            "audio"),
        ("audio/m4a",            "audio"),
        ("audio/ogg",            "audio"),
        ("video/mp4",            "video"),
        ("video/quicktime",      "video"),
        ("video/x-matroska",     "video"),
        ("video/webm",           "video"),
        ("application/pdf",      "pdf"),
        ("text/plain",           "text"),
        ("text/plain; charset=utf-8", "text"),
    ])
    def test_known_types(self, mime: str, expected: str):
        assert detect_file_kind(mime) == expected

    def test_unknown_type_falls_back_to_audio(self):
        # Shouldn't reach detect_file_kind with an unknown MIME (blocked by save_file),
        # but if it does, the fallback should be safe
        assert detect_file_kind("application/octet-stream") == "text"


# ── MIME allowlist ────────────────────────────────────────────────────────────

class TestAllowedMimeTypes:

    @pytest.mark.parametrize("mime", [
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "audio/m4a",
        "audio/flac",
        "video/mp4",
        "video/quicktime",
        "video/x-matroska",
        "video/webm",
        "video/avi",
        "application/pdf",
        "text/plain",
    ])
    def test_allowed_mime_is_accepted(self, mime: str):
        assert any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES), \
            f"{mime!r} should be allowed but ALLOWED_MIME_PREFIXES = {ALLOWED_MIME_PREFIXES}"

    @pytest.mark.parametrize("mime", [
        "application/exe",
        "application/x-msdownload",
        "image/png",
        "application/zip",
        "application/javascript",
    ])
    def test_dangerous_types_are_blocked(self, mime: str):
        assert not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES), \
            f"{mime!r} should NOT be allowed"


# ── Size limits ───────────────────────────────────────────────────────────────

class TestSizeLimits:

    def test_av_max_size_is_500mb(self):
        assert MAX_FILE_SIZE == 500 * 1024 * 1024

    def test_pdf_max_size_is_50mb(self):
        assert MAX_PDF_SIZE == 50 * 1024 * 1024

    def test_pdf_limit_is_smaller_than_av_limit(self):
        assert MAX_PDF_SIZE < MAX_FILE_SIZE


# ── AI client routing ─────────────────────────────────────────────────────────

class TestAiClientRouting:

    def test_pdf_routes_to_process_pdf_endpoint(self):
        from unittest.mock import patch, MagicMock
        from pathlib import Path
        from app.services.ai_client import process_meeting

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "languePrincipale": "pdf",
            "dureeSecondes": 0,
            "transcription": "test",
            "segments": [],
            "resume": "r",
            "pointsCles": [],
            "conclusions": [],
            "pageCount": 5,
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_response

            result = process_meeting(Path("/tmp/test.pdf"), "application/pdf", "pdf")

            call_url = instance.post.call_args[0][0]
            assert call_url.endswith("/process-pdf"), \
                f"PDF should route to /process-pdf, got: {call_url}"

    def test_audio_routes_to_process_endpoint(self):
        from unittest.mock import patch, MagicMock
        from pathlib import Path
        from app.services.ai_client import process_meeting

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "languePrincipale": "fr",
            "dureeSecondes": 120,
            "transcription": "test",
            "segments": [],
            "resume": "r",
            "pointsCles": [],
            "conclusions": [],
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_response

            result = process_meeting(Path("/tmp/test.mp3"), "audio/mpeg", "audio")

            call_url = instance.post.call_args[0][0]
            assert call_url.endswith("/process"), \
                f"Audio should route to /process, got: {call_url}"

    def test_video_routes_to_process_endpoint(self):
        from unittest.mock import patch, MagicMock
        from pathlib import Path
        from app.services.ai_client import process_meeting

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "languePrincipale": "fr", "dureeSecondes": 300,
            "transcription": "t", "segments": [],
            "resume": "r", "pointsCles": [], "conclusions": [],
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_response

            result = process_meeting(Path("/tmp/test.mp4"), "video/mp4", "video")

            call_url = instance.post.call_args[0][0]
            assert call_url.endswith("/process"), \
                f"Video should route to /process, got: {call_url}"
