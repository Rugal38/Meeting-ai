"""
GroqUsageTracker — persists daily Groq API usage in a local SQLite file.

Limits are read from env vars at call-time so they can be changed without restart:
  GROQ_DAILY_REQUEST_LIMIT  (default 1000  — free-tier RPD for llama-3.3-70b-versatile)
  GROQ_DAILY_TOKEN_LIMIT    (default 100000 — free-tier TPD)

Thresholds:
  ≥ 80 %  → WARNING log
  ≥ 95 %  → HTTP 503 raised + CRITICAL log + optional webhook POST
"""

import json
import logging
import os
import sqlite3
import threading
from datetime import date, datetime
from pathlib import Path

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_WARN_PCT    = 0.80
_REJECT_PCT  = 0.95

_DB_PATH = Path(__file__).resolve().parents[3] / "groq_usage.db"
_lock    = threading.Lock()


def _limits() -> tuple[int, int]:
    req = int(os.environ.get("GROQ_DAILY_REQUEST_LIMIT", "1000"))
    tok = int(os.environ.get("GROQ_DAILY_TOKEN_LIMIT",   "100000"))
    return req, tok


class GroqUsageTracker:
    def __init__(self) -> None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _lock:
            with sqlite3.connect(_DB_PATH) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS groq_daily_usage (
                        usage_date     TEXT PRIMARY KEY,
                        request_count  INTEGER NOT NULL DEFAULT 0,
                        total_tokens   INTEGER NOT NULL DEFAULT 0,
                        updated_at     TEXT
                    )
                """)
                conn.commit()
        logger.info("GroqUsageTracker initialised — DB: %s", _DB_PATH)

    # ── Public API ────────────────────────────────────────────────────────────

    def check(self) -> None:
        """Call BEFORE every Groq API request. Raises HTTP 503 at 95 %."""
        usage = self._today_usage()
        req_limit, tok_limit = _limits()

        req_pct = usage["request_count"] / req_limit
        tok_pct = usage["total_tokens"]  / tok_limit if tok_limit else 0
        pct     = max(req_pct, tok_pct)

        if pct >= _REJECT_PCT:
            self._notify_admin(usage, req_limit, tok_limit, pct)
            raise HTTPException(
                status_code=503,
                detail={
                    "code":    "GROQ_DAILY_LIMIT_REACHED",
                    "message": (
                        f"AI service has used {pct * 100:.0f}% of its daily Groq quota. "
                        "New analysis jobs are paused until midnight UTC. "
                        "Contact your administrator."
                    ),
                    "usage":  usage,
                    "limits": {"requests": req_limit, "tokens": tok_limit},
                },
            )

        if pct >= _WARN_PCT:
            logger.warning(
                "Groq daily usage at %.0f%% — requests %d/%d, tokens %d/%d",
                pct * 100,
                usage["request_count"], req_limit,
                usage["total_tokens"],  tok_limit,
            )

    def record(self, prompt_tokens: int, completion_tokens: int) -> None:
        """Call AFTER a successful Groq API response."""
        today  = date.today().isoformat()
        tokens = prompt_tokens + completion_tokens
        now    = datetime.utcnow().isoformat()

        with _lock:
            with sqlite3.connect(_DB_PATH) as conn:
                conn.execute(
                    """
                    INSERT INTO groq_daily_usage (usage_date, request_count, total_tokens, updated_at)
                    VALUES (?, 1, ?, ?)
                    ON CONFLICT(usage_date) DO UPDATE SET
                        request_count = request_count + 1,
                        total_tokens  = total_tokens  + excluded.total_tokens,
                        updated_at    = excluded.updated_at
                    """,
                    (today, tokens, now),
                )
                conn.commit()

    def get_stats(self) -> dict:
        """Return today's usage stats — used by /health endpoint."""
        usage = self._today_usage()
        req_limit, tok_limit = _limits()

        req_pct = round(usage["request_count"] / req_limit * 100, 1)
        tok_pct = round(usage["total_tokens"]  / tok_limit * 100, 1) if tok_limit else 0
        pct     = max(req_pct, tok_pct)

        status = "ok"
        if pct >= _REJECT_PCT * 100:
            status = "critical"
        elif pct >= _WARN_PCT * 100:
            status = "warning"

        return {
            "date":           date.today().isoformat(),
            "status":         status,
            "requests":       usage["request_count"],
            "request_limit":  req_limit,
            "request_pct":    req_pct,
            "tokens":         usage["total_tokens"],
            "token_limit":    tok_limit,
            "token_pct":      tok_pct,
        }

    # ── Internals ─────────────────────────────────────────────────────────────

    def _today_usage(self) -> dict:
        today = date.today().isoformat()
        with _lock:
            with sqlite3.connect(_DB_PATH) as conn:
                row = conn.execute(
                    "SELECT request_count, total_tokens FROM groq_daily_usage WHERE usage_date = ?",
                    (today,),
                ).fetchone()
        return {"request_count": row[0], "total_tokens": row[1]} if row else {"request_count": 0, "total_tokens": 0}

    def _notify_admin(self, usage: dict, req_limit: int, tok_limit: int, pct: float) -> None:
        logger.critical(
            "GROQ QUOTA CRITICAL (%.0f%%) — requests %d/%d, tokens %d/%d — "
            "New analysis jobs are being REJECTED. Admin action required.",
            pct * 100,
            usage["request_count"], req_limit,
            usage["total_tokens"],  tok_limit,
        )
        webhook = os.environ.get("ADMIN_WEBHOOK_URL")
        if not webhook:
            return
        payload = {
            "event":   "groq_quota_critical",
            "message": f"Groq daily quota at {pct * 100:.0f}%. New jobs are blocked.",
            "usage":   usage,
            "limits":  {"requests": req_limit, "tokens": tok_limit},
        }
        try:
            httpx.post(webhook, json=payload, timeout=5)
            logger.info("Admin webhook notified: %s", webhook)
        except Exception as exc:
            logger.warning("Admin webhook failed: %s", exc)


# Module-level singleton — imported by groq_client
tracker = GroqUsageTracker()
