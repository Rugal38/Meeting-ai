from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Usage, User

PLAN_LIMITS: dict[str, dict] = {
    "free":     {"transcription_minutes": 30.0,   "summaries": 10},
    "pro":      {"transcription_minutes": 600.0,  "summaries": 100},
    "business": {"transcription_minutes": None,   "summaries": None},  # None = unlimited
}


def _period_bounds() -> tuple[datetime, datetime]:
    """Monthly rolling window: first day of current month → last day."""
    now = datetime.utcnow()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # End = first day of next month minus one microsecond
    if now.month == 12:
        end = start.replace(year=now.year + 1, month=1)
    else:
        end = start.replace(month=now.month + 1)
    return start, end - timedelta(microseconds=1)


def get_or_create_usage(user: User, db: Session) -> Usage:
    """Return the Usage record that covers today, creating one if needed."""
    now = datetime.utcnow()
    usage = (
        db.query(Usage)
        .filter(Usage.user_id == user.id, Usage.period_start <= now, Usage.period_end >= now)
        .first()
    )
    if usage:
        return usage

    period_start, period_end = _period_bounds()
    usage = Usage(user_id=user.id, period_start=period_start, period_end=period_end)
    db.add(usage)
    db.flush()
    return usage


def get_limits(plan_tier: str) -> dict:
    return PLAN_LIMITS.get(plan_tier, PLAN_LIMITS["free"])


def check_transcription_limit(user: User, db: Session) -> None:
    """Raise HTTP 402 if the user has exhausted their transcription quota."""
    limits = get_limits(user.plan_tier or "free")
    if limits["transcription_minutes"] is None:
        return  # unlimited
    usage = get_or_create_usage(user, db)
    if usage.transcription_minutes_used >= limits["transcription_minutes"]:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "TRANSCRIPTION_LIMIT_REACHED",
                "message": f"You have used all {limits['transcription_minutes']} transcription minutes for this period.",
                "upgrade_url": "/billing",
            },
        )


def check_summary_limit(user: User, db: Session) -> None:
    """Raise HTTP 402 if the user has exhausted their summary quota."""
    limits = get_limits(user.plan_tier or "free")
    if limits["summaries"] is None:
        return  # unlimited
    usage = get_or_create_usage(user, db)
    if usage.summaries_generated >= limits["summaries"]:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "SUMMARY_LIMIT_REACHED",
                "message": f"You have used all {limits['summaries']} summaries for this period.",
                "upgrade_url": "/billing",
            },
        )


def increment_transcription(user_id: int, duration_seconds: float, db: Session) -> None:
    """Add processed duration to the user's usage record. Uses a fresh session lookup."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    usage = get_or_create_usage(user, db)
    usage.transcription_minutes_used += duration_seconds / 60.0
    usage.updated_at = datetime.utcnow()
    db.commit()


def increment_summaries(user_id: int, db: Session) -> None:
    """Increment summary count for the user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    usage = get_or_create_usage(user, db)
    usage.summaries_generated += 1
    usage.updated_at = datetime.utcnow()
    db.commit()


def reset_usage_for_period(user: User, period_start: datetime, period_end: datetime, db: Session) -> None:
    """Reset or create a fresh usage record for the given period (called on billing renewal)."""
    usage = (
        db.query(Usage)
        .filter(Usage.user_id == user.id, Usage.period_start >= period_start - timedelta(days=1))
        .first()
    )
    if usage:
        usage.transcription_minutes_used = 0
        usage.summaries_generated = 0
        usage.period_start = period_start
        usage.period_end = period_end
        usage.updated_at = datetime.utcnow()
    else:
        db.add(Usage(user_id=user.id, period_start=period_start, period_end=period_end))
    db.flush()
