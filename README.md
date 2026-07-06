# Resume Customizer

Paste a job description, upload your resume (PDF or DOCX), and get an AI-tailored version back —
rewritten summary, reordered/highlighted skills, JD-aligned experience bullets, a JD match score,
an ATS score with tips, a diff view showing exactly what changed, a list of keywords you might be
missing, and an optional AI-generated cover letter. Download the resume as plain text, DOCX, or
PDF, and the cover letter as plain text.

**Live demo:** frontend — https://ai-powered-resume-builder-frontend-one.vercel.app · backend — https://resume-customizer-backend-production.up.railway.app

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend   | Python, FastAPI, Uvicorn/Gunicorn |
| Resume parsing | `pdfplumber` (PDF), `python-docx` (DOCX) |
| LLM       | Google Gemini (`gemini-2.5-flash`) via `google-generativeai`, JSON mode |
| Export    | `python-docx` (DOCX), `reportlab` (PDF), plain text |
| Hosting   | Vercel (frontend), Railway (backend, Docker) |

No database — the API is stateless. Each request parses the uploaded resume, calls the LLM,
scores the match, computes a diff, and returns everything the frontend needs in one response.

## Architecture

```
┌─────────────────────┐        multipart/form-data          ┌──────────────────────────┐
│                      │  POST /api/tailor                   │                          │
│  Next.js Frontend    │ ───────────────────────────────▶   │   FastAPI Backend        │
│  (Vercel)            │   { resume file, job_description }  │   (Railway, Docker)      │
│                      │                                      │                          │
│  - JdInput           │ ◀───────────────────────────────    │  1. parsing.py           │
│  - ResumeUpload      │   { match_score, matched_keywords,   │     extract text (PDF/   │
│  - ResultView        │     missing_keywords,                │     DOCX)                │
│  - DiffView          │     tailored_resume,                 │  2. scoring.py           │
│  - ErrorBanner       │     original_summary, diff }         │     JD keyword match     │
│                      │                                      │     vs. original resume  │
│                      │  POST /api/export                    │  3. llm.py               │
│                      │   { format, tailored_resume }        │     Gemini JSON-mode call│
│                      │ ◀───────────────────────────────     │  4. diff.py              │
│                      │   binary file (txt/docx/pdf)          │     word-level diff      │
│                      │                                      │  5. export.py            │
└─────────────────────┘                                      │     txt/docx/pdf builder │
                                                               └──────────────────────────┘
```

## LLM integration

- Provider/model: **Google Gemini**, `gemini-2.5-flash` (configurable via `GEMINI_MODEL`).
- Uses Gemini's JSON response mode (`response_mime_type: application/json`) with a system
  prompt (`backend/app/llm.py`) instructing the model to rewrite the summary, reorder/select
  matching skills, rephrase experience bullets toward JD keywords, and report keywords the
  resume doesn't cover — all while staying truthful to the candidate's actual background (no
  fabricated employers, titles, or metrics).
- On a transient failure (e.g. rate limiting), the backend retries up to 3 times with backoff
  before returning a `502` with a readable error message.

## Match score & keyword matching

`backend/app/scoring.py` computes the match score by extracting JD-relevant keywords (role
skills, certifications, soft skills, plus capitalized proper-noun-shaped terms scraped directly
from the JD text) and checking which of them — or a known alias — appear in the **original**
uploaded resume text. This gives a percentage match and a matched/missing keyword list that's
independent of the LLM, so it stays consistent even if the LLM call fails.

## Diff view

`backend/app/diff.py` computes a word-level diff (Python stdlib `difflib.SequenceMatcher`, no
extra dependency) between a heuristically-extracted "original summary" (from a Summary/Objective/
Profile section in the raw resume text) and the LLM's rewritten summary, plus a set-difference on
skills (added / removed / kept). The frontend's `DiffView` component renders this as inline
highlighted spans and skill-change pill lists, toggled from the result view.

## ATS score (bonus)

`backend/app/scoring.py::compute_ats_score` scores the **uploaded resume text itself** (independent
of the JD) against common applicant-tracking-system heuristics: use of strong action verbs,
presence of quantified/metric bullets (`%`, `$`, multipliers, counts), standard section headers
(Experience, Education, Skills, etc.), and reasonable overall length. Returns a 0–100 score plus
short actionable tips (e.g. "add more quantified metrics to your bullets"), rendered next to the
JD match score.

## Cover letter generator (bonus)

`POST /api/cover-letter` (`backend/app/llm.py::generate_cover_letter`) sends the tailored resume
plus the JD to Gemini with a dedicated prompt to draft a concise, role-specific cover letter,
reusing the same anti-hallucination constraints as the resume-tailoring prompt. Available from the
result view after a resume has been tailored; downloadable as `.txt`.

## Local setup

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:3000`, upload a resume (see `sample_jd.txt` for a sample JD), paste a job
description, and submit.

## Known limitations / trade-offs

- **Heuristic match score** — the JD-match percentage is keyword/alias based, not a semantic
  or embedding-based score. It's fast, free, and explainable, but can miss paraphrased skills
  the LLM itself would understand.
- **Heuristic original-summary/skills extraction for diffing** — since the uploaded resume is
  parsed as flat text, the "original" summary/skills used for the diff view are found via a
  best-effort section-heading search (Summary/Objective/Profile, Skills). If the source resume
  doesn't use recognizable headings, the diff may be sparse.
- **No formatting round-trip** — the tailored resume is rebuilt into DOCX/PDF from structured
  text; original visual styling (fonts, columns, tables) from the uploaded file is not
  preserved.
- **No auth, no persistence** — every request is stateless; nothing is stored server-side.
- **No streaming** — the tailoring call is a single synchronous request; large JDs/resumes or a
  slow LLM response mean the user waits for the full round trip (a loading state is shown).
- **Single LLM pass** — one call produces the full tailored resume; there's no section-by-section
  regeneration or multi-turn refinement yet.

## Screenshots

_Add screenshots or a short demo GIF of the golden path here before submitting._
