from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models import JobStatus


class CamelModel(BaseModel):
    """Base schema that serializes to camelCase — matches the frontend JSON contract."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    nom: str


class JwtResponse(CamelModel):
    token: str
    type: str = "Bearer"
    id: int
    email: str
    nom: str
    role: str = "user"
    plan_tier: str = "free"


# ── Meetings ──────────────────────────────────────────────────────────────────

class TranscriptionOut(CamelModel):
    id: int
    texte_complet: Optional[str] = None
    segments_json: Optional[str] = None
    date_creation: datetime


class ResumeOut(CamelModel):
    id: int
    texte_resume: Optional[str] = None
    points_cles: Optional[str] = None
    conclusions: Optional[str] = None
    date_creation: datetime


class ProcessingJobOut(CamelModel):
    id: int
    statut: JobStatus
    message_erreur: Optional[str] = None
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    date_creation: datetime
    groq_requests_used: int = 0


class FileRecordOut(CamelModel):
    file_kind: Optional[str] = None
    page_count: Optional[int] = None


class MeetingOut(CamelModel):
    id: int
    titre: Optional[str] = None
    statut: JobStatus
    langue: Optional[str] = None
    duree_secondes: Optional[float] = None
    date_creation: datetime
    transcription:  Optional[TranscriptionOut]  = None
    resume:         Optional[ResumeOut]         = None
    processing_job: Optional[ProcessingJobOut]  = None
    file_record:    Optional[FileRecordOut]     = None


# ── Profile ───────────────────────────────────────────────────────────────────

class ProfileUpdateRequest(BaseModel):
    nom: Optional[str] = None
    email: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class ProfileUpdateResponse(CamelModel):
    nom: str
    email: str
    token: Optional[str] = None


# ── Billing ───────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    price_id: str


class CheckoutResponse(CamelModel):
    checkout_url: str


class PortalResponse(CamelModel):
    portal_url: str


class BillingStatusOut(CamelModel):
    plan_tier: str
    subscription_status: str
    current_period_end: Optional[datetime] = None
    has_stripe_customer: bool


# ── Usage ─────────────────────────────────────────────────────────────────────

class UsageLimits(CamelModel):
    transcription_minutes: Optional[float] = None
    summaries: Optional[int] = None


class UsageOut(CamelModel):
    transcription_minutes_used: float
    summaries_generated: int
    period_start: datetime
    period_end: datetime
    plan_tier: str
    limits: UsageLimits


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminUsageOut(CamelModel):
    transcription_minutes_used: float
    summaries_generated: int
    period_start: datetime
    period_end: datetime


class AdminUserOut(CamelModel):
    id: int
    email: str
    nom: Optional[str] = None
    role: str
    plan_tier: str
    subscription_status: str
    date_creation: datetime
    deleted_at: Optional[datetime] = None
    usage: Optional[AdminUsageOut] = None


class AdminJobOut(CamelModel):
    id: int
    meeting_id: int
    meeting_titre: Optional[str] = None
    user_email: Optional[str] = None
    statut: JobStatus
    date_creation: datetime
    date_fin: Optional[datetime] = None


class AdminStatsOut(CamelModel):
    total_users: int
    mrr: float
    subscriptions_by_plan: dict
    active_jobs: int
    failed_jobs_24h: int


class OverridePlanRequest(BaseModel):
    plan_tier: str
