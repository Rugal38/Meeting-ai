# MeetingAI — Claude Code Guide

AI meeting assistant that transcribes audio/video, summarizes PDFs, and generates key points and conclusions. Production-grade SaaS with Stripe billing, usage limits, an admin dashboard, and a suite of standalone AI tools. Academic MVP targeting FR/EN meetings; Darija support is planned for a later phase.

---

## Architecture

Three services that must all run simultaneously:

```
Frontend (React/Vite)  ←→  Backend (FastAPI/Python)  ←→  AI Service (FastAPI)
     :5173                         :8080                       :8000
```

| Layer | Stack | Directory |
|-------|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Framer Motion | `Frontend/` |
| Backend | Python FastAPI + SQLAlchemy + SQLite/PostgreSQL + JWT + Stripe | `Backend_FastAPI/` |
| AI Service | Python FastAPI + faster-whisper + Groq API (LLaMA 3.3 70B) + pdfplumber | `Ai_Service/` |

> `Backend/` (Spring Boot) is kept for reference but is **no longer the active backend**.

---

## Start Commands

```bash
# 1 — AI Service (start first — Whisper loads at import, LLM loads on first request)
cd Ai_Service
.\venv\Scripts\activate          # Python 3.10 venv — required for torch/CUDA
uvicorn app.main:app --reload    # http://localhost:8000

# 2 — Backend
cd Backend_FastAPI
.\venv\Scripts\activate          # Python 3.14 venv — no torch dependency
uvicorn app.main:app --reload --port 8080   # http://localhost:8080

# 3 — Frontend
cd Frontend
npm install                      # first time only
npm run dev                      # http://localhost:5173
```

Interactive API docs: http://localhost:8080/docs  
First-time backend setup: `cp .env.example .env` then fill in JWT_SECRET and Stripe keys.

---

## Key Source Files

### Frontend (`Frontend/src/`)
| File | Purpose |
|------|---------|
| `App.tsx` | Root router, AnimatePresence transitions, PrivateRoute, AdminRoute |
| `pages/LoginPage.tsx` | JWT login |
| `pages/SignupPage.tsx` | Registration |
| `pages/DashboardPage.tsx` | File upload (audio/video/PDF), meeting history, job polling, UsageWidget; sidebar with tools nav |
| `pages/MeetingDetailPage.tsx` | Tabs: continuous transcript script + summary/insights; PDF download for both |
| `pages/BillingPage.tsx` | Current plan, usage summary, Stripe Checkout, Customer Portal |
| `pages/AdminDashboard.tsx` | Admin-only: stats, user management, job monitor |
| `pages/ProfilePage.tsx` | Edit name, email, password; issues new JWT if email changes |
| `pages/NewFeaturesPage.tsx` | Static page: available tools + coming-soon features grid |
| `pages/AudioToTextPage.tsx` | Upload audio → transcription text + .txt download |
| `pages/VideoToTextPage.tsx` | Upload video → transcription text + .txt download |
| `pages/PdfToTextPage.tsx` | Upload PDF → raw extracted text + .txt download; free users: 3/day limit |
| `pages/TranslatePdfPage.tsx` | Upload PDF + select language (EN/FR/AR) → translated text + .txt download |
| `components/UsageWidget.tsx` | Sidebar usage bars (transcription min + summaries) |
| `services/api.ts` | Axios instances: `api` (30s timeout) + `toolsAxios` (10 min); exports `billingApi`, `usageApi`, `adminApi`, `profileApi`, `toolsApi` |
| `types/index.ts` | Shared TS interfaces: User (role, planTier), BillingStatus, UsageData, AdminStats |
| `lib/animations.ts` | Shared Framer Motion variants |
| `index.css` | Unified stylesheet (NEXUS Design System); sidebar nav scrolls, footer always visible |

### Backend (`Backend_FastAPI/app/`)
| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, CORS, lifespan (create_all + SQLite migrations), slowapi rate limiter |
| `database.py` | SQLAlchemy engine + `get_db` dependency |
| `models.py` | ORM models: User, Meeting, Transcription, Resume, ProcessingJob, FileRecord, Usage (+ `pdf_tools_today`, `pdf_tools_date`) |
| `schemas.py` | Pydantic schemas with camelCase aliases; includes ProfileUpdateRequest/Response |
| `core/config.py` | Settings: JWT, upload, AI service URL, Stripe keys (5 vars), frontend URL |
| `core/security.py` | JWT (HS256 + role claim) + bcrypt |
| `core/deps.py` | `get_current_user` (soft-delete aware), `require_admin` |
| `core/usage.py` | Plan limits, usage enforcement (check/increment/reset), `get_or_create_usage` |
| `core/rate_limit.py` | slowapi Limiter, per-user key function |
| `routers/auth.py` | POST /login, POST /signup, PATCH /profile (name/email/password; reissues JWT on email change) |
| `routers/meetings.py` | Upload (usage check + rate limit), list, get, delete; GET /api/reunions/usage |
| `routers/billing.py` | GET /status, POST /create-checkout-session, POST /create-portal-session, POST /webhook; price IDs evaluated at request time (not cached at import) |
| `routers/admin.py` | GET /stats, GET /users, PATCH /users/{id}/plan, POST /users/{id}/reset-usage, GET /jobs |
| `routers/tools.py` | POST /audio-to-text, /video-to-text, /pdf-to-text (3/day free limit), GET /pdf-to-text/status, POST /translate-pdf |
| `services/file_storage.py` | Upload validation (audio/video/PDF/text), UUID naming, path-traversal protection |
| `services/ai_client.py` | httpx POST to AI service — routes audio/video → /process, PDF → /process-pdf |
| `services/stripe_service.py` | Stripe SDK init, price→plan mapping, MRR calculation |
| `tests/test_billing.py` | Stripe webhook signature verification tests |
| `tests/test_usage.py` | Usage limit enforcement tests |
| `tests/test_file_routing.py` | File type detection and AI service routing tests |

### AI Service (`Ai_Service/app/`)
| Module | Purpose |
|--------|---------|
| `routers/analysis.py` | POST /api/process (audio/video), POST /api/process-pdf; multi-chunk map-reduce |
| `routers/transcribe.py` | POST /api/transcribe — transcription only; returns `{ text, language, segments, duration }` |
| `routers/tools.py` | POST /api/extract-text (PDF → raw text, no LLM), POST /api/translate (PDF → translated text via LLM) |
| `services/whisper_service.py` | faster-whisper medium (int8, CUDA, VAD enabled); returns key `"text"` (not `"full_text"`) |
| `services/llm_service.py` | Groq LLaMA 3.3 70B via `call_mistral()`; `analyze_text()` (3–5 para summary, 8–12 points, 5–8 conclusions), `translate_text()` (EN/FR/AR) |
| `services/ffmpeg_service.py` | Video → WAV (mono, 16 kHz) |
| `services/chunking_service.py` | Text chunking for long transcripts |
| `services/pdf_service.py` | pdfplumber text extraction; raises ValueError on scanned PDFs (< 50 chars) |

---

## Hardware Constraint — CRITICAL

Target machine: **RTX 3070 (8 GB VRAM), Ryzen 7 5800H, 16 GB RAM**.

- Whisper uses `compute_type="int8"` — never float32.
- LLM is Groq API (remote) — no local GPU usage for inference.
- `vad_filter=True` is set on Whisper — required for long recordings (prevents 1.15 GB FFT allocation).
- Do not suggest models larger than 7B for any local inference.

### Windows Virtual Memory (one-time setup)
Set paging file to **30 000 MB on D:**. Path: *Start → Adjust the appearance and performance of Windows → Advanced → Virtual Memory → Change*.

---

## Python Environments

| Service | Venv Python | Reason |
|---------|-------------|--------|
| `Ai_Service/` | **3.10** | torch/CUDA/faster-whisper require ≤ 3.11 |
| `Backend_FastAPI/` | 3.14 | No torch — any modern Python works |

Never mix these venvs.

---

## Database

**Development:** SQLite (`meetingai.db` in `Backend_FastAPI/`) — persists across restarts.  
**Production target:** PostgreSQL — set `DATABASE_URL=postgresql://...` in `.env`.

Core tables: `utilisateurs`, `reunions`, `fichiers`, `transcriptions`, `resumes`, `jobs_traitement`, `usages`.

**Automatic migrations:** `main.py` lifespan runs `ALTER TABLE` statements on startup for new columns. Safe to re-run; errors (column already exists) are silently ignored.

Current migration columns added beyond the initial schema:
- `utilisateurs`: stripe fields, plan_tier, subscription_status, current_period_end, role, deleted_at
- `fichiers`: file_kind, page_count
- `jobs_traitement`: groq_requests_used
- `usages`: pdf_tools_today, pdf_tools_date

---

## Plans & Pricing

| Plan | Price | Transcription | Summaries | PDF Tools |
|------|-------|--------------|-----------|-----------|
| Free | $0 | 30 min/month | 10/month | 3 PDF extractions/day |
| Pro | $9.99/month | 600 min/month | 100/month | Unlimited |
| Business | $29.99/month | Unlimited | Unlimited | Unlimited |

Usage resets on `invoice.payment_succeeded` (Stripe webhook) or at the start of each calendar month for free users. PDF tool daily counter resets at midnight (date comparison in `pdf_tools_date`).

---

## Standalone Tools (`/tools/*`)

All tools require JWT auth. Rate limited via slowapi.

| Tool | Route | Free limit | Notes |
|------|-------|-----------|-------|
| Audio → Text | `/tools/audio-to-text` | None | Calls AI `/api/transcribe`; result key is `"text"` |
| Video → Text | `/tools/video-to-text` | None | Same as audio |
| PDF → Text | `/tools/pdf-to-text` | 3/day | Calls AI `/api/extract-text`; HTTP 429 on limit |
| Translate PDF | `/tools/translate-pdf` | None | Calls AI `/api/translate`; query param `target_language=en\|fr\|ar` |

**Critical:** Whisper returns `"text"` (not `"full_text"`). The backend tools router must read `data.get("text", "")`.

---

## Stripe Integration

**Required env vars** (in `Backend_FastAPI/.env`):
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...        ← must be a Price ID, not a Product ID (prod_...)
STRIPE_BUSINESS_PRICE_ID=price_...
```

**Frontend env vars** (in `Frontend/.env`):
```
VITE_STRIPE_PRO_PRICE_ID=price_...
VITE_STRIPE_BUSINESS_PRICE_ID=price_...
```

**Webhook setup** (local dev):
```bash
stripe listen --forward-to localhost:8080/api/billing/webhook
```

**Handled webhook events:**
- `checkout.session.completed` → activate subscription, store customer/subscription IDs
- `customer.subscription.updated` → update plan tier
- `customer.subscription.deleted` → downgrade to Free
- `invoice.payment_failed` → flag account as `past_due`
- `invoice.payment_succeeded` → reset usage for new billing period

**Important:** Price IDs are evaluated at request time inside the handler — not cached at module import. This fixes a bug where env vars loaded after import resulted in empty allowed-price sets.

---

## Rate Limiting

slowapi per-user rate limits (key = JWT email, fallback = IP):
- Upload: 10/hour
- List meetings: 60/minute
- Billing endpoints: 10/minute
- Audio/video tools: 10/hour
- PDF-to-text tool: 20/hour (+ daily free-tier cap enforced separately)
- Translate PDF: 10/hour

---

## Admin Access

To make a user admin, run once against the SQLite DB:
```bash
sqlite3 Backend_FastAPI/meetingai.db \
  "UPDATE utilisateurs SET role='admin' WHERE email='you@example.com';"
```

The admin dashboard is at `/admin` — only accessible when `role = 'admin'` is in the stored user object.

---

## Soft Delete

Users are soft-deleted by setting `deleted_at`. They cannot log in after deletion. A 30-day recovery window is enforced manually; no automated cleanup (add a cron job for production).

---

## File Support

### Meeting pipeline (full analysis)
| Type | Extensions | Max Size | Pipeline |
|------|-----------|---------|---------|
| Audio | mp3, wav, m4a, ogg, flac | 500 MB | Whisper → LLM |
| Video | mp4, mov, mkv, webm, avi | 500 MB | FFmpeg → Whisper → LLM |
| PDF | pdf | 50 MB | pdfplumber → LLM (no Whisper) |
| Text | txt | 500 MB | Text sent directly to LLM |

### Standalone tools
| Tool | Accepts | Max Size |
|------|---------|---------|
| Audio → Text | audio/* | 500 MB |
| Video → Text | video/* | 500 MB |
| PDF → Text | application/pdf | 50 MB |
| Translate PDF | application/pdf | 50 MB |

PDFs with no extractable text (scanned/image-based) return HTTP 422 in all pipelines.

---

## Security Rules (Do Not Break)

- JWT secret from `JWT_SECRET` env var — never hardcode it.
- `file_storage.py` has path-traversal protection — preserve it.
- AI service only accepts requests from `localhost`/`127.0.0.1` (TrustedHostMiddleware).
- `trust_remote_code=False` in LLM loader — do not change this.
- File uploads validated server-side: MIME type prefix, size cap, extension regex.
- SQLite `check_same_thread=False` is required in `database.py` — do not remove it.
- Stripe webhook HMAC signature verified on every request — never skip this check.
- `require_admin` dependency gates all `/api/admin/*` routes.
- Profile email change issues a new JWT — frontend must update both `localStorage.token` and `localStorage.user`.

---

## Known Bugs Fixed

| Bug | Root cause | Fix applied |
|-----|-----------|-------------|
| `passlib` bcrypt 500 error | passlib incompatible with bcrypt ≥ 4.x | Replaced with direct `bcrypt` calls |
| CORS + 500 on GET /api/reunions | `duree_secondes` typed as `int`, AI returns float | Changed column + schema to `Float` |
| 401 after backend switch | Old Spring Boot JWT token in localStorage | Clear localStorage and re-login |
| 1h video gives no result | httpx timeout was 600s, processing takes ~14-30 min | Raised timeout to 7200s |
| RAM error on long audio | Whisper FFT allocated 1.15 GB for full audio at once | Added `vad_filter=True` |
| Paging file error on LLM reload | Windows can't memory-map 4GB model with small paging file | Keep LLM resident; increase paging file |
| Only first chunk analysed | analysis.py used `chunks[0]` only | Multi-chunk map-reduce: each chunk → mini summary → final synthesis |
| Windows /tmp/ path error | Hardcoded /tmp/ doesn't exist on Windows | Replaced with `tempfile.mkstemp()` |
| Stripe upgrade broken | `_ALLOWED_PRICE_IDS` cached at import with empty strings | Moved allowed-set computation inside the request handler |
| Stripe "No such price" error | Product ID (`prod_...`) used instead of Price ID (`price_...`) | Use the Price ID from Stripe Dashboard → Products → Pricing table |
| Audio/video tools return empty text | Backend read `data["full_text"]`; Whisper returns `data["text"]` | Changed to `data.get("text", "")` |
| Sidebar footer hidden | Nav grew past viewport with new tool items | Added `overflow-y: auto; min-height: 0` to `.sidebar-nav` |

---

## Processing Times (RTX 3070 reference)

| File | Transcription | LLM | Total |
|------|--------------|-----|-------|
| 4-min video | ~1 min | ~6 min | ~7 min |
| 1-hour video | ~12 min | ~20 min | ~30 min |
| 50-page PDF | — | ~4 min | ~4 min |

---

## Project Status

**Working end-to-end:**
- Auth: login, signup, JWT with role + plan_tier, profile editing (name/email/password)
- File upload: audio, video, PDF (up to limits), async processing with job polling
- Short and long recordings (tested up to 1h), multi-chunk LLM map-reduce
- Meeting detail: continuous transcript script view, PDF download (transcript + summary)
- AI summaries: 3–5 paragraphs, 8–12 key points, 5–8 conclusions
- Standalone tools: Audio→Text, Video→Text, PDF→Text (3/day free), Translate PDF (EN/FR/AR)
- Dark-theme UI with Framer Motion animations (NEXUS Design System)
- Sidebar: scrollable nav with footer (usage widget + logout) always visible
- Persistent SQLite database with auto-migration on startup
- Stripe Checkout + Customer Portal + webhook handler (5 events)
- Usage tracking per billing period; HTTP 402 enforcement before processing
- Billing page: plan cards, upgrade CTA, portal button
- Admin dashboard: stats, user management, job monitor
- Per-user rate limiting (slowapi), soft-delete on User accounts

**Roadmap (priority order):**
1. PostgreSQL migration (replace SQLite for multi-user / production)
2. Celery + Redis job queue (replace in-process BackgroundTasks — jobs lost on restart)
3. Email notifications (payment failed, job completed)
4. Speaker diarization (identify who said what)
5. Darija (Moroccan Arabic) language support
6. Production deployment (Railway, Render, or AWS)

**Job queue note:** Processing uses FastAPI `BackgroundTasks` (in-process). Jobs are lost if the server restarts mid-processing. Acceptable for single-instance MVP; replace with Celery + Redis for production.
