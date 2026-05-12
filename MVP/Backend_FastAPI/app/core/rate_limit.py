from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.security import decode_token


def _key_func(request: Request) -> str:
    """Rate-limit by authenticated user email, falling back to IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        email = decode_token(auth[7:])
        if email:
            return f"user:{email}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_key_func)
