import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_admin
from app.core.usage import get_or_create_usage, get_limits, reset_usage_for_period, _period_bounds
from app.database import get_db
from app.models import Meeting, ProcessingJob, User, Usage, JobStatus
from app.schemas import (
    AdminJobOut, AdminStatsOut, AdminUserOut, AdminUsageOut, OverridePlanRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_PLANS = {"free", "pro", "business"}


@router.get("/stats", response_model=AdminStatsOut)
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    total_users = db.query(User).filter(User.deleted_at.is_(None)).count()

    subscriptions_by_plan = {
        "free":     db.query(User).filter(User.plan_tier == "free",     User.deleted_at.is_(None)).count(),
        "pro":      db.query(User).filter(User.plan_tier == "pro",      User.deleted_at.is_(None)).count(),
        "business": db.query(User).filter(User.plan_tier == "business", User.deleted_at.is_(None)).count(),
    }

    mrr = _calculate_mrr(subscriptions_by_plan)

    active_jobs = db.query(ProcessingJob).filter(
        ProcessingJob.statut == JobStatus.EN_COURS
    ).count()

    since_24h = datetime.utcnow() - timedelta(hours=24)
    failed_jobs_24h = db.query(ProcessingJob).filter(
        ProcessingJob.statut == JobStatus.ERREUR,
        ProcessingJob.date_creation >= since_24h,
    ).count()

    return AdminStatsOut(
        total_users=total_users,
        mrr=mrr,
        subscriptions_by_plan=subscriptions_by_plan,
        active_jobs=active_jobs,
        failed_jobs_24h=failed_jobs_24h,
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.query(User)
    if search:
        q = q.filter(User.email.ilike(f"%{search}%"))
    users = q.offset((page - 1) * limit).limit(limit).all()

    result = []
    for user in users:
        usage = _get_current_usage(user, db)
        result.append(_user_to_out(user, usage))
    return result


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    usage = _get_current_usage(user, db)
    return _user_to_out(user, usage)


@router.patch("/users/{user_id}/plan")
def override_plan(
    user_id: int,
    body: OverridePlanRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if body.plan_tier not in VALID_PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan_tier}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.plan_tier = body.plan_tier
    user.subscription_status = "active"
    db.commit()
    logger.info("Admin overrode plan to %s for user %s", body.plan_tier, user.email)
    return {"message": f"Plan updated to {body.plan_tier}"}


@router.post("/users/{user_id}/reset-usage")
def reset_user_usage(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    period_start, period_end = _period_bounds()
    reset_usage_for_period(user, period_start, period_end, db)
    db.commit()
    logger.info("Admin reset usage for user %s", user.email)
    return {"message": "Usage reset"}


@router.get("/jobs", response_model=list[AdminJobOut])
def list_jobs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    jobs = (
        db.query(ProcessingJob)
        .options(joinedload(ProcessingJob.meeting).joinedload(Meeting.user))
        .order_by(ProcessingJob.date_creation.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    result = []
    for job in jobs:
        result.append(AdminJobOut(
            id=job.id,
            meeting_id=job.meeting_id,
            meeting_titre=job.meeting.titre if job.meeting else None,
            user_email=job.meeting.user.email if job.meeting and job.meeting.user else None,
            statut=job.statut,
            date_creation=job.date_creation,
            date_fin=job.date_fin,
        ))
    return result


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calculate_mrr(subscriptions_by_plan: dict) -> float:
    """Try Stripe API first; fall back to DB-calculated estimate."""
    from app.core.config import settings
    if settings.stripe_secret_key:
        try:
            from app.services.stripe_service import calculate_mrr
            return calculate_mrr()
        except Exception as exc:
            logger.warning("Stripe MRR fetch failed, falling back to estimate: %s", exc)
    return subscriptions_by_plan.get("pro", 0) * 9.99 + subscriptions_by_plan.get("business", 0) * 29.99


def _get_current_usage(user: User, db: Session) -> Optional[Usage]:
    now = datetime.utcnow()
    return (
        db.query(Usage)
        .filter(Usage.user_id == user.id, Usage.period_start <= now, Usage.period_end >= now)
        .first()
    )


def _user_to_out(user: User, usage: Optional[Usage]) -> AdminUserOut:
    usage_out = None
    if usage:
        usage_out = AdminUsageOut(
            transcription_minutes_used=usage.transcription_minutes_used,
            summaries_generated=usage.summaries_generated,
            period_start=usage.period_start,
            period_end=usage.period_end,
        )
    return AdminUserOut(
        id=user.id,
        email=user.email,
        nom=user.nom,
        role=user.role or "user",
        plan_tier=user.plan_tier or "free",
        subscription_status=user.subscription_status or "active",
        date_creation=user.date_creation,
        deleted_at=user.deleted_at,
        usage=usage_out,
    )
