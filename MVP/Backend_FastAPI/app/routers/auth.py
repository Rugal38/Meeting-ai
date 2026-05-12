from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import JwtResponse, LoginRequest, ProfileUpdateRequest, ProfileUpdateResponse, SignupRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=JwtResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.deleted_at.is_(None)).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return JwtResponse(
        token=create_access_token(user.email, role=user.role or "user"),
        id=user.id,
        email=user.email,
        nom=user.nom or "",
        role=user.role or "user",
        plan_tier=user.plan_tier or "free",
    )


@router.post("/signup", response_model=JwtResponse)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    user = User(
        email=body.email,
        password=hash_password(body.password),
        nom=body.nom,
        role="user",
        plan_tier="free",
        subscription_status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return JwtResponse(
        token=create_access_token(user.email, role="user"),
        id=user.id,
        email=user.email,
        nom=user.nom or "",
        role="user",
        plan_tier="free",
    )


@router.patch("/profile", response_model=ProfileUpdateResponse)
def update_profile(
    body: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.nom is not None:
        name = body.nom.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        current_user.nom = name

    new_token = None
    if body.email and body.email.strip().lower() != current_user.email.lower():
        new_email = body.email.strip().lower()
        if db.query(User).filter(User.email == new_email, User.deleted_at.is_(None)).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = new_email
        new_token = create_access_token(new_email, role=current_user.role or "user")

    if body.new_password:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password required")
        if not verify_password(body.current_password, current_user.password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if len(body.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
        current_user.password = hash_password(body.new_password)

    db.commit()
    return ProfileUpdateResponse(
        nom=current_user.nom or "",
        email=current_user.email,
        token=new_token,
    )
