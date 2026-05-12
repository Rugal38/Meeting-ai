from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from app.core.rate_limit import limiter
from app.database import Base, engine, get_db
from app.routers import auth, meetings
from app.routers import billing, admin, tools


# ── SQLite migrations (runs at startup, safe to re-run) ─────────────────────

_MIGRATIONS = [
    # utilisateurs — new SaaS columns
    "ALTER TABLE utilisateurs ADD COLUMN stripe_customer_id TEXT",
    "ALTER TABLE utilisateurs ADD COLUMN stripe_subscription_id TEXT",
    "ALTER TABLE utilisateurs ADD COLUMN plan_tier TEXT DEFAULT 'free'",
    "ALTER TABLE utilisateurs ADD COLUMN subscription_status TEXT DEFAULT 'active'",
    "ALTER TABLE utilisateurs ADD COLUMN current_period_end TEXT",
    "ALTER TABLE utilisateurs ADD COLUMN role TEXT DEFAULT 'user'",
    "ALTER TABLE utilisateurs ADD COLUMN deleted_at TEXT",
    # fichiers — file kind + page count
    "ALTER TABLE fichiers ADD COLUMN file_kind TEXT DEFAULT 'audio'",
    "ALTER TABLE fichiers ADD COLUMN page_count INTEGER",
    # jobs_traitement — Groq usage tracking
    "ALTER TABLE jobs_traitement ADD COLUMN groq_requests_used INTEGER DEFAULT 0",
    # usages — PDF tools daily counter
    "ALTER TABLE usages ADD COLUMN pdf_tools_today INTEGER DEFAULT 0",
    "ALTER TABLE usages ADD COLUMN pdf_tools_date TEXT",
]


def _run_migrations() -> None:
    with engine.connect() as conn:
        for sql in _MIGRATIONS:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()   # column already exists — ignore


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="MeetingAI Backend", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(billing.router)
app.include_router(admin.router)
app.include_router(tools.router)


@app.get("/health")
def health():
    return {"status": "ok"}
