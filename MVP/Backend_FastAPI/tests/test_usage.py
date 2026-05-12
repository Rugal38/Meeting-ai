"""Tests for usage limit enforcement."""
import os
from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("STRIPE_SECRET_KEY", "")

from app.database import Base
from app.models import Usage, User
from app.core.usage import (
    PLAN_LIMITS,
    check_summary_limit,
    check_transcription_limit,
    get_or_create_usage,
    increment_summaries,
    increment_transcription,
    reset_usage_for_period,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _make_user(db, plan: str = "free") -> User:
    user = User(email=f"test_{plan}_{id(db)}@example.com", password="x", plan_tier=plan)
    db.add(user)
    db.flush()
    return user


# ── Plan limits constants ─────────────────────────────────────────────────────

class TestPlanLimits:

    def test_free_plan_has_30_minutes(self):
        assert PLAN_LIMITS["free"]["transcription_minutes"] == 30.0

    def test_free_plan_has_10_summaries(self):
        assert PLAN_LIMITS["free"]["summaries"] == 10

    def test_pro_plan_has_600_minutes(self):
        assert PLAN_LIMITS["pro"]["transcription_minutes"] == 600.0

    def test_pro_plan_has_100_summaries(self):
        assert PLAN_LIMITS["pro"]["summaries"] == 100

    def test_business_plan_is_unlimited(self):
        assert PLAN_LIMITS["business"]["transcription_minutes"] is None
        assert PLAN_LIMITS["business"]["summaries"] is None


# ── Usage record creation ─────────────────────────────────────────────────────

class TestGetOrCreateUsage:

    def test_creates_usage_record_for_new_user(self, db):
        user = _make_user(db)
        usage = get_or_create_usage(user, db)
        assert usage.user_id == user.id
        assert usage.transcription_minutes_used == 0.0
        assert usage.summaries_generated == 0

    def test_returns_same_record_within_period(self, db):
        user = _make_user(db)
        u1 = get_or_create_usage(user, db)
        db.flush()
        u2 = get_or_create_usage(user, db)
        assert u1.id == u2.id


# ── Transcription limit enforcement ─────────────────────────────────────────

class TestTranscriptionLimit:

    def test_under_limit_does_not_raise(self, db):
        user = _make_user(db, "free")
        usage = get_or_create_usage(user, db)
        usage.transcription_minutes_used = 10.0
        db.flush()
        check_transcription_limit(user, db)   # should not raise

    def test_at_limit_raises_402(self, db):
        from fastapi import HTTPException
        user = _make_user(db, "free")
        usage = get_or_create_usage(user, db)
        usage.transcription_minutes_used = 30.0  # exactly at limit
        db.flush()
        with pytest.raises(HTTPException) as exc_info:
            check_transcription_limit(user, db)
        assert exc_info.value.status_code == 402

    def test_over_limit_raises_402(self, db):
        from fastapi import HTTPException
        user = _make_user(db, "free")
        usage = get_or_create_usage(user, db)
        usage.transcription_minutes_used = 45.0
        db.flush()
        with pytest.raises(HTTPException) as exc_info:
            check_transcription_limit(user, db)
        assert exc_info.value.status_code == 402

    def test_business_plan_never_raises(self, db):
        user = _make_user(db, "business")
        usage = get_or_create_usage(user, db)
        usage.transcription_minutes_used = 99999.0
        db.flush()
        check_transcription_limit(user, db)   # should not raise


# ── Summary limit enforcement ────────────────────────────────────────────────

class TestSummaryLimit:

    def test_under_limit_does_not_raise(self, db):
        user = _make_user(db, "free")
        usage = get_or_create_usage(user, db)
        usage.summaries_generated = 5
        db.flush()
        check_summary_limit(user, db)

    def test_at_limit_raises_402(self, db):
        from fastapi import HTTPException
        user = _make_user(db, "free")
        usage = get_or_create_usage(user, db)
        usage.summaries_generated = 10  # exactly at limit
        db.flush()
        with pytest.raises(HTTPException) as exc_info:
            check_summary_limit(user, db)
        assert exc_info.value.status_code == 402

    def test_pro_limit_is_100(self, db):
        from fastapi import HTTPException
        user = _make_user(db, "pro")
        usage = get_or_create_usage(user, db)
        usage.summaries_generated = 99
        db.flush()
        check_summary_limit(user, db)   # 99 < 100, no raise
        usage.summaries_generated = 100
        db.flush()
        with pytest.raises(HTTPException):
            check_summary_limit(user, db)


# ── Usage increment ───────────────────────────────────────────────────────────

class TestIncrements:

    def test_increment_transcription_adds_minutes(self, db):
        user = _make_user(db)
        get_or_create_usage(user, db)
        db.commit()
        increment_transcription(user.id, 120.0, db)   # 120s = 2 min
        usage = get_or_create_usage(user, db)
        assert abs(usage.transcription_minutes_used - 2.0) < 0.01

    def test_increment_summaries(self, db):
        user = _make_user(db)
        get_or_create_usage(user, db)
        db.commit()
        increment_summaries(user.id, db)
        increment_summaries(user.id, db)
        usage = get_or_create_usage(user, db)
        assert usage.summaries_generated == 2


# ── Usage reset ───────────────────────────────────────────────────────────────

class TestResetUsage:

    def test_reset_clears_counters(self, db):
        user = _make_user(db, "pro")
        usage = get_or_create_usage(user, db)
        usage.transcription_minutes_used = 200.0
        usage.summaries_generated = 50
        db.commit()

        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = period_start + timedelta(days=31)
        reset_usage_for_period(user, period_start, period_end, db)
        db.commit()

        updated = get_or_create_usage(user, db)
        assert updated.transcription_minutes_used == 0.0
        assert updated.summaries_generated == 0
