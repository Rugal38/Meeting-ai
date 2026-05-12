import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.core.usage import (
    check_summary_limit, check_transcription_limit,
    increment_summaries, increment_transcription,
)
from app.database import SessionLocal, get_db
from app.models import FileRecord, JobStatus, Meeting, ProcessingJob, Resume, Transcription, User
from app.schemas import MeetingOut, UsageOut, UsageLimits
from app.services.ai_client import process_meeting
from app.services.file_storage import delete_file, get_path, save_file
from app.core.usage import get_or_create_usage, get_limits

router = APIRouter(prefix="/api/reunions", tags=["meetings"])


def _to_json_str(value) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value or [])


def _process_in_background(meeting_id: int, stored_name: str, content_type: str, file_kind: str, user_id: int) -> None:
    """Background task: call AI service, persist results, update job status, record usage."""
    db: Session = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        job = meeting.processing_job
        job.date_debut = datetime.utcnow()
        db.commit()

        file_path = get_path(stored_name)
        result = process_meeting(file_path, content_type, file_kind)

        meeting.statut         = JobStatus.TERMINE
        meeting.langue         = result.get("languePrincipale")
        meeting.duree_secondes = result.get("dureeSecondes")

        db.add(Transcription(
            meeting_id=meeting_id,
            texte_complet=result.get("transcription"),
            segments_json=_to_json_str(result.get("segments")),
        ))
        db.add(Resume(
            meeting_id=meeting_id,
            texte_resume=result.get("resume"),
            points_cles=_to_json_str(result.get("pointsCles")),
            conclusions=_to_json_str(result.get("conclusions")),
        ))

        # Update page_count on FileRecord for PDFs
        if file_kind == "pdf" and result.get("pageCount"):
            file_rec = db.query(FileRecord).filter(FileRecord.meeting_id == meeting_id).first()
            if file_rec:
                file_rec.page_count = result.get("pageCount")

        job.statut             = JobStatus.TERMINE
        job.date_fin           = datetime.utcnow()
        job.groq_requests_used = result.get("groqRequestsUsed", 0)
        db.commit()

        # Record usage after successful processing
        duration = result.get("dureeSecondes") or 0.0
        if file_kind != "pdf" and duration > 0:
            increment_transcription(user_id, duration, db)
        increment_summaries(user_id, db)

    except Exception as exc:
        db.rollback()
        try:
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if meeting:
                meeting.statut = JobStatus.ERREUR
                job = meeting.processing_job
                if job:
                    job.statut         = JobStatus.ERREUR
                    job.message_erreur = str(exc)
                    job.date_fin       = datetime.utcnow()
            db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


@router.post("/upload", response_model=MeetingOut)
@limiter.limit("10/hour")
def upload_meeting(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    titre: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stored_name, original_name, content_type, size, file_kind = save_file(file)

    # Enforce usage limits before queuing the job
    if file_kind == "pdf":
        check_summary_limit(current_user, db)
    else:
        check_transcription_limit(current_user, db)
        check_summary_limit(current_user, db)

    meeting = Meeting(titre=titre, statut=JobStatus.EN_COURS, user_id=current_user.id)
    db.add(meeting)
    db.flush()

    db.add(FileRecord(
        meeting_id=meeting.id,
        nom_original=original_name,
        nom_stocke=stored_name,
        type_mime=content_type,
        taille_octets=size,
        chemin=stored_name,
        file_kind=file_kind,
    ))
    db.add(ProcessingJob(
        meeting_id=meeting.id,
        statut=JobStatus.EN_COURS,
        date_debut=datetime.utcnow(),
    ))
    db.commit()
    db.refresh(meeting)

    background_tasks.add_task(
        _process_in_background, meeting.id, stored_name, content_type, file_kind, current_user.id
    )
    return meeting


@router.get("/usage", response_model=UsageOut)
def get_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    usage = get_or_create_usage(current_user, db)
    db.commit()
    limits = get_limits(current_user.plan_tier or "free")
    return UsageOut(
        transcription_minutes_used=usage.transcription_minutes_used,
        summaries_generated=usage.summaries_generated,
        period_start=usage.period_start,
        period_end=usage.period_end,
        plan_tier=current_user.plan_tier or "free",
        limits=UsageLimits(
            transcription_minutes=limits["transcription_minutes"],
            summaries=limits["summaries"],
        ),
    )


def _meeting_query(db: Session):
    return db.query(Meeting).options(
        joinedload(Meeting.transcription),
        joinedload(Meeting.resume),
        joinedload(Meeting.processing_job),
        joinedload(Meeting.file_record),
    )


@router.get("", response_model=list[MeetingOut])
@limiter.limit("60/minute")
def list_meetings(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        _meeting_query(db)
        .filter(Meeting.user_id == current_user.id)
        .order_by(Meeting.date_creation.desc())
        .all()
    )


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = _meeting_query(db).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return meeting


@router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if meeting.file_record:
        delete_file(meeting.file_record.nom_stocke)

    db.delete(meeting)
    db.commit()
    return {"message": "Meeting deleted"}
