import os
import time
import logging

from groq import Groq

from app.services.usage_tracker import tracker

logger = logging.getLogger(__name__)

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable is not set")
        _client = Groq(api_key=api_key)
    return _client


_DEFAULT_MODEL = "llama-3.3-70b-versatile"


def call_mistral(prompt: str, max_tokens: int = 1000) -> str:
    """Call the configured Groq model. Retries once on rate-limit or timeout."""
    tracker.check()   # raises HTTP 503 at 95 %, logs warning at 80 %

    client = _get_client()
    model  = os.environ.get("GROQ_MODEL", _DEFAULT_MODEL)

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.3,
            )
            content   = response.choices[0].message.content or ""
            api_usage = response.usage
            logger.info(
                "Groq call OK [%s] — prompt=%d tokens, completion=%d tokens, total=%d tokens",
                model,
                api_usage.prompt_tokens,
                api_usage.completion_tokens,
                api_usage.total_tokens,
            )
            tracker.record(api_usage.prompt_tokens, api_usage.completion_tokens)
            return content

        except Exception as exc:
            exc_name = type(exc).__name__
            is_retryable = any(k in exc_name for k in ("RateLimitError", "Timeout", "APITimeoutError"))
            if attempt == 0 and is_retryable:
                logger.warning("Groq %s on attempt 1 — retrying in 2 s…", exc_name)
                time.sleep(2)
                continue
            logger.error("Groq call failed after %d attempt(s): %s: %s", attempt + 1, exc_name, exc)
            raise

    raise RuntimeError("Groq call failed after retry")
