import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class JobStatus(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    EN_COURS   = "EN_COURS"
    TERMINE    = "TERMINE"
    ERREUR     = "ERREUR"


class User(Base):
    __tablename__ = "utilisateurs"

    id                     = Column(Integer, primary_key=True, index=True)
    email                  = Column(String, unique=True, nullable=False, index=True)
    password               = Column(String, nullable=False)
    nom                    = Column(String)
    date_creation          = Column(DateTime, default=datetime.utcnow)

    # Billing
    stripe_customer_id     = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    plan_tier              = Column(String, default="free")          # free | pro | business
    subscription_status    = Column(String, default="active")        # active | past_due | canceled | trialing
    current_period_end     = Column(DateTime, nullable=True)

    # Access control
    role                   = Column(String, default="user")          # user | admin

    # Soft-delete
    deleted_at             = Column(DateTime, nullable=True)

    meetings = relationship("Meeting", back_populates="user", cascade="all, delete-orphan")
    usages   = relationship("Usage",   back_populates="user", cascade="all, delete-orphan")


class Meeting(Base):
    __tablename__ = "reunions"

    id             = Column(Integer, primary_key=True, index=True)
    titre          = Column(String)
    statut         = Column(Enum(JobStatus), default=JobStatus.EN_ATTENTE)
    langue         = Column(String)
    duree_secondes = Column(Float)
    date_creation  = Column(DateTime, default=datetime.utcnow)
    user_id        = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)

    user           = relationship("User", back_populates="meetings")
    transcription  = relationship("Transcription", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    resume         = relationship("Resume",         back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    processing_job = relationship("ProcessingJob",  back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    file_record    = relationship("FileRecord",     back_populates="meeting", uselist=False, cascade="all, delete-orphan")


class Transcription(Base):
    __tablename__ = "transcriptions"

    id            = Column(Integer, primary_key=True, index=True)
    meeting_id    = Column(Integer, ForeignKey("reunions.id"), nullable=False)
    texte_complet = Column(Text)
    segments_json = Column(Text)
    date_creation = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="transcription")


class Resume(Base):
    __tablename__ = "resumes"

    id            = Column(Integer, primary_key=True, index=True)
    meeting_id    = Column(Integer, ForeignKey("reunions.id"), nullable=False)
    texte_resume  = Column(Text)
    points_cles   = Column(Text)
    conclusions   = Column(Text)
    date_creation = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="resume")


class ProcessingJob(Base):
    __tablename__ = "jobs_traitement"

    id                 = Column(Integer, primary_key=True, index=True)
    meeting_id         = Column(Integer, ForeignKey("reunions.id"), nullable=False)
    statut             = Column(Enum(JobStatus), default=JobStatus.EN_ATTENTE)
    message_erreur     = Column(Text)
    date_debut         = Column(DateTime)
    date_fin           = Column(DateTime)
    date_creation      = Column(DateTime, default=datetime.utcnow)
    groq_requests_used = Column(Integer, default=0)

    meeting = relationship("Meeting", back_populates="processing_job")


class FileRecord(Base):
    __tablename__ = "fichiers"

    id            = Column(Integer, primary_key=True, index=True)
    meeting_id    = Column(Integer, ForeignKey("reunions.id"), nullable=False)
    nom_original  = Column(String)
    nom_stocke    = Column(String)
    type_mime     = Column(String)
    taille_octets = Column(BigInteger)
    chemin        = Column(String)
    date_upload   = Column(DateTime, default=datetime.utcnow)
    file_kind     = Column(String, default="audio")   # audio | video | pdf | text
    page_count    = Column(Integer, nullable=True)    # PDF only

    meeting = relationship("Meeting", back_populates="file_record")


class Usage(Base):
    """Per-user, per-billing-period usage counters."""
    __tablename__ = "usages"

    id                          = Column(Integer, primary_key=True, index=True)
    user_id                     = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False, index=True)
    period_start                = Column(DateTime, nullable=False)
    period_end                  = Column(DateTime, nullable=False)
    transcription_minutes_used  = Column(Float, default=0.0)
    summaries_generated         = Column(Integer, default=0)
    pdf_tools_today             = Column(Integer, default=0)
    pdf_tools_date              = Column(String, nullable=True)
    updated_at                  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="usages")
