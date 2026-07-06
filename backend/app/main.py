import io
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from . import diff as diff_module
from . import export, llm, parsing, scoring
from .parsing import ParseError
from .llm import LLMError
from .schemas import (
    CoverLetterRequest,
    CoverLetterResponse,
    ExportRequest,
    TailorResponse,
    TailoredResume,
)

MAX_UPLOAD_MB = float(os.getenv("MAX_UPLOAD_MB", "5"))
MIN_JD_LENGTH = 50

app = FastAPI(title="Resume Customizer API", version="1.0.0")

_origins_env = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_keywords_db = scoring.load_keywords_db()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/tailor", response_model=TailorResponse)
async def tailor(resume: UploadFile = File(...), job_description: str = Form(default="")):
    jd_text = (job_description or "").strip()
    if len(jd_text) < MIN_JD_LENGTH:
        raise HTTPException(
            400,
            f"Job description looks too short — please paste the full JD "
            f"(at least {MIN_JD_LENGTH} characters).",
        )

    filename = resume.filename or ""
    if not filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(400, "Only .pdf and .docx resumes are supported.")

    data = await resume.read()
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(400, f"Resume file is too large (max {MAX_UPLOAD_MB:.0f}MB).")
    if not data:
        raise HTTPException(400, "Uploaded resume file is empty.")

    try:
        resume_text = parsing.extract_text(filename, data)
    except ParseError as e:
        raise HTTPException(400, str(e)) from e

    if not resume_text.strip():
        raise HTTPException(400, "No extractable text found in the uploaded resume.")

    score = scoring.score_resume_text(resume_text, jd_text, _keywords_db)
    ats = scoring.compute_ats_score(resume_text, _keywords_db)

    try:
        raw = llm.tailor_resume(resume_text, jd_text, score["missing_keywords"])
    except LLMError as e:
        raise HTTPException(502, f"The AI service failed to generate a tailored resume: {e}") from e

    try:
        tailored = TailoredResume(**raw)
    except (ValidationError, TypeError) as e:
        raise HTTPException(502, f"The AI returned an unexpected format: {e}") from e

    missing_keywords = raw.get("missing_keywords") or score["missing_keywords"]

    original_summary, original_skills = parsing.extract_summary_and_skills(resume_text)
    resume_diff = diff_module.compute_diff(original_summary, original_skills, tailored)

    return TailorResponse(
        match_score=score["match_score"],
        matched_keywords=score["matched_keywords"],
        missing_keywords=missing_keywords,
        tailored_resume=tailored,
        original_summary=original_summary,
        diff=resume_diff,
        ats_score=ats["ats_score"],
        ats_tips=ats["ats_tips"],
    )


@app.post("/api/cover-letter", response_model=CoverLetterResponse)
def cover_letter(req: CoverLetterRequest):
    jd_text = (req.job_description or "").strip()
    if len(jd_text) < MIN_JD_LENGTH:
        raise HTTPException(
            400,
            f"Job description looks too short — please paste the full JD "
            f"(at least {MIN_JD_LENGTH} characters).",
        )

    try:
        text = llm.generate_cover_letter(req.tailored_resume.model_dump(), jd_text)
    except LLMError as e:
        raise HTTPException(502, f"The AI service failed to generate a cover letter: {e}") from e

    return CoverLetterResponse(cover_letter=text)


@app.post("/api/export")
def export_resume(req: ExportRequest):
    if req.format == "txt":
        content = export.resume_to_text(req.tailored_resume).encode("utf-8")
        media_type = "text/plain"
        ext = "txt"
    elif req.format == "docx":
        content = export.resume_to_docx(req.tailored_resume)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"
    else:
        content = export.resume_to_pdf(req.tailored_resume)
        media_type = "application/pdf"
        ext = "pdf"

    filename = f"tailored_resume.{ext}"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
