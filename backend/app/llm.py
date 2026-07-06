import json
import os
import time
from typing import List

import google.generativeai as genai

SYSTEM_PROMPT = """You are an expert resume writer and career coach specializing in tailoring \
resumes to specific job descriptions.

You will be given a candidate's raw resume text (extracted from a PDF/DOCX, so formatting may \
be imperfect) and a job description. Produce a tailored version of the resume as STRICT JSON \
matching this exact shape, with no markdown, no commentary, no code fences:

{
  "name": "candidate full name if present, else empty string",
  "contact": "single line of contact info (email, phone, links) if present, else empty string",
  "summary": "2-4 sentence professional summary rewritten to align with the job description",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {"title": "", "company": "", "dates": "", "location": "", "bullets": ["", ""]}
  ],
  "education": [
    {"school": "", "degree": "", "dates": ""}
  ],
  "other_sections": [
    {"heading": "Certifications", "content": "raw text for this section"}
  ],
  "missing_keywords": ["keywords from the JD the candidate's resume does not currently cover"]
}

Rules:
- Rewrite the summary so it speaks directly to what this job description asks for, while staying \
truthful to the candidate's actual background. Never invent employers, titles, or years of experience.
- From the candidate's existing skills, select and reorder those most relevant to the job \
description first. Do not invent skills the candidate does not have evidence of in their resume.
- Reorder and lightly rephrase experience bullets (without fabricating achievements or metrics) to \
foreground job-description-relevant keywords and impact. Keep every bullet grounded in something \
the original resume actually said.
- Preserve education and other sections (certifications, projects, awards, etc.) largely as-is, \
lightly cleaned up for formatting.
- List missing_keywords: terms that matter for this job description but are not evidenced anywhere \
in the candidate's resume, so the candidate can decide whether to add them if true.
- Output ONLY the JSON object. No prose before or after it.
"""


COVER_LETTER_SYSTEM_PROMPT = """You are an expert career coach writing a concise, compelling cover \
letter for a candidate applying to a specific job.

You will be given the job description and the candidate's tailored resume (as JSON). Write a \
cover letter as plain text (no markdown, no headings, no placeholders like "[Company Name]" \
unless that information is genuinely absent from the job description).

Rules:
- 3-4 short paragraphs: an opening that names the role and shows genuine interest, a middle that \
connects 2-3 of the candidate's strongest, most relevant experiences/skills to what the job \
description asks for, and a closing that invites next steps.
- Stay strictly truthful to the candidate's resume. Never invent employers, titles, years of \
experience, metrics, or skills not present in the resume JSON.
- Do not repeat the resume verbatim — synthesize and connect it to the job description in the \
candidate's voice.
- Output ONLY the cover letter text. No subject line, no "Dear Hiring Manager" boilerplate \
beyond a natural greeting, no commentary before or after.
"""


class LLMError(RuntimeError):
    pass


def _configure() -> None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise LLMError("GEMINI_API_KEY is not configured on the server.")
    genai.configure(api_key=api_key)


def tailor_resume(resume_text: str, jd_text: str, missing_keywords: List[str]) -> dict:
    _configure()
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    model = genai.GenerativeModel(model_name, system_instruction=SYSTEM_PROMPT)

    hint = ", ".join(missing_keywords) if missing_keywords else "none detected"
    user_prompt = (
        f"JOB DESCRIPTION:\n{jd_text}\n\n"
        f"CANDIDATE RESUME (raw extracted text):\n{resume_text}\n\n"
        f"Keywords present in the JD but not obviously in the resume: {hint}\n\n"
        "Return the tailored resume as the JSON object described in your instructions."
    )

    generation_config = {
        "response_mime_type": "application/json",
        "temperature": 0.4,
    }

    last_err: Exception | None = None
    for attempt, wait_seconds in enumerate((0, 5, 15), start=1):
        if wait_seconds:
            time.sleep(wait_seconds)
        try:
            response = model.generate_content(
                user_prompt,
                generation_config=generation_config,
                request_options={"timeout": 30},
            )
            return json.loads(response.text)
        except Exception as e:  # noqa: BLE001 - broad by design, retried below
            last_err = e
            continue

    raise LLMError(f"Gemini call failed after {attempt} attempts: {last_err}")


def generate_cover_letter(tailored_resume: dict, jd_text: str) -> str:
    _configure()
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    model = genai.GenerativeModel(model_name, system_instruction=COVER_LETTER_SYSTEM_PROMPT)

    user_prompt = (
        f"JOB DESCRIPTION:\n{jd_text}\n\n"
        f"CANDIDATE'S TAILORED RESUME (JSON):\n{json.dumps(tailored_resume)}\n\n"
        "Write the cover letter now, as plain text."
    )

    last_err: Exception | None = None
    for attempt, wait_seconds in enumerate((0, 5, 15), start=1):
        if wait_seconds:
            time.sleep(wait_seconds)
        try:
            response = model.generate_content(
                user_prompt,
                generation_config={"temperature": 0.5},
                request_options={"timeout": 30},
            )
            text = (response.text or "").strip()
            if not text:
                raise LLMError("Gemini returned an empty cover letter.")
            return text
        except Exception as e:  # noqa: BLE001 - broad by design, retried below
            last_err = e
            continue

    raise LLMError(f"Gemini call failed after {attempt} attempts: {last_err}")
