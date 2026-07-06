from typing import List, Literal

from pydantic import BaseModel, Field


class ExperienceEntry(BaseModel):
    title: str = ""
    company: str = ""
    dates: str = ""
    location: str = ""
    bullets: List[str] = Field(default_factory=list)


class EducationEntry(BaseModel):
    school: str = ""
    degree: str = ""
    dates: str = ""


class OtherSection(BaseModel):
    heading: str = ""
    content: str = ""


class TailoredResume(BaseModel):
    name: str = ""
    contact: str = ""
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    experience: List[ExperienceEntry] = Field(default_factory=list)
    education: List[EducationEntry] = Field(default_factory=list)
    other_sections: List[OtherSection] = Field(default_factory=list)


class DiffSpan(BaseModel):
    text: str
    kind: Literal["same", "added", "removed"]


class ResumeDiff(BaseModel):
    summary: List[DiffSpan] = Field(default_factory=list)
    skills_added: List[str] = Field(default_factory=list)
    skills_removed: List[str] = Field(default_factory=list)
    skills_kept: List[str] = Field(default_factory=list)


class TailorResponse(BaseModel):
    match_score: int
    matched_keywords: List[str]
    missing_keywords: List[str]
    tailored_resume: TailoredResume
    original_summary: str = ""
    diff: ResumeDiff
    ats_score: int = 0
    ats_tips: List[str] = Field(default_factory=list)


class ExportRequest(BaseModel):
    format: Literal["txt", "docx", "pdf"]
    tailored_resume: TailoredResume


class CoverLetterRequest(BaseModel):
    job_description: str
    tailored_resume: TailoredResume


class CoverLetterResponse(BaseModel):
    cover_letter: str
