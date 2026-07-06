import json
import re
from pathlib import Path
from typing import Dict, List

DATA_DIR = Path(__file__).parent / "data"
KEYWORDS_DB_PATH = DATA_DIR / "tech_keywords.json"

JD_STOP_PROPER_NOUNS = {
    "The", "This", "That", "These", "Those", "We", "You", "Our", "Your",
    "I", "It", "They", "He", "She",
    "Inc", "LLC", "Ltd", "Corp", "Co",
    "Responsibilities", "Requirements", "Qualifications", "Overview",
    "About", "Role", "Position", "Job", "Description", "Summary",
    "Benefits", "Perks", "Location", "Salary", "Compensation",
    "Please", "Note", "Apply", "Join", "Come", "Looking", "Seeking",
    "Equal", "Opportunity", "Employer", "Diversity", "Inclusion",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
}

_PROPER_NOUN_RE = re.compile(r"\b([A-Z][a-zA-Z0-9+#]+(?:[ \-/][A-Z][a-zA-Z0-9+#]+){0,2})\b")


def load_keywords_db() -> dict:
    if KEYWORDS_DB_PATH.exists():
        return json.loads(KEYWORDS_DB_PATH.read_text(encoding="utf-8"))
    return {}


def _kw_regex(kw: str) -> re.Pattern:
    escaped = re.escape(kw)
    return re.compile(r"(?<![\w])" + escaped + r"(?![\w])", re.IGNORECASE)


def _contains_kw(text: str, kw: str) -> bool:
    if not kw:
        return False
    return bool(_kw_regex(kw).search(text))


def extract_jd_keywords(jd_text: str, keywords_db: dict) -> set:
    seed = set()
    for role_data in keywords_db.get("roles", {}).values():
        for category_values in role_data.values():
            if isinstance(category_values, list):
                seed.update(category_values)

    for category_values in keywords_db.get("certifications_keywords", {}).values():
        if isinstance(category_values, list):
            seed.update(category_values)

    seed.update(keywords_db.get("soft_skills", []))

    in_jd = {kw for kw in seed if _contains_kw(jd_text, kw)}

    for match in _PROPER_NOUN_RE.finditer(jd_text):
        token = match.group(1).strip().strip(".,;:()")
        if not token or len(token) <= 2:
            continue
        if any(word in JD_STOP_PROPER_NOUNS for word in token.split()):
            continue
        in_jd.add(token)

    return in_jd


def _alias_candidates(kw: str, aliases_db: dict) -> set:
    candidates = {kw}
    for canonical, aliases in aliases_db.items():
        group = set(aliases) | {canonical}
        if kw in group:
            candidates.update(group)
    return candidates


def score_resume_text(resume_text: str, jd_text: str, keywords_db: dict) -> Dict:
    jd_keywords = extract_jd_keywords(jd_text, keywords_db)
    aliases_db = keywords_db.get("common_aliases", {})

    matched: List[str] = []
    missing: List[str] = []

    for kw in sorted(jd_keywords, key=str.lower):
        if _contains_kw(resume_text, kw):
            matched.append(kw)
            continue
        aliases = [a for a in _alias_candidates(kw, aliases_db) if a != kw]
        if any(_contains_kw(resume_text, alias) for alias in aliases):
            matched.append(kw)
        else:
            missing.append(kw)

    total = len(matched) + len(missing)
    match_score = round(100.0 * len(matched) / total) if total else 0

    return {
        "match_score": match_score,
        "matched_keywords": matched,
        "missing_keywords": missing,
    }


_METRIC_RE = re.compile(r"\d+(\.\d+)?\s*(%|percent|x\b)|\$\s?\d|\b\d{2,}\+?\b")
_SECTION_HEADERS = {
    "experience": ["experience", "employment history", "work history"],
    "education": ["education"],
    "skills": ["skills", "technical skills", "core competencies"],
}


def compute_ats_score(resume_text: str, keywords_db: dict) -> Dict:
    text = resume_text or ""
    lower = text.lower()
    word_count = len(text.split())

    action_verbs = keywords_db.get("ats_action_verbs", [])
    metrics_phrases = keywords_db.get("ats_metrics_phrases", [])

    verbs_found = {v for v in action_verbs if _contains_kw(text, v)}
    verb_score = min(100, round(len(verbs_found) * 12.5))

    metric_hits = len(_METRIC_RE.findall(text))
    metric_hits += sum(1 for phrase in metrics_phrases if _contains_kw(text, phrase))
    metrics_score = min(100, round(metric_hits * 15))

    sections_found = sum(
        1 for aliases in _SECTION_HEADERS.values() if any(a in lower for a in aliases)
    )
    section_score = round(100 * sections_found / len(_SECTION_HEADERS))

    if word_count < 150:
        length_score = round(100 * word_count / 150)
    elif word_count <= 900:
        length_score = 100
    else:
        length_score = max(40, 100 - round((word_count - 900) / 20))

    overall = round(
        0.3 * verb_score + 0.3 * metrics_score + 0.2 * section_score + 0.2 * length_score
    )

    tips: List[str] = []
    if verb_score < 60:
        tips.append("Start more bullet points with strong action verbs (e.g. Led, Built, Automated).")
    if metrics_score < 60:
        tips.append("Quantify more achievements with numbers, percentages, or dollar amounts.")
    if section_score < 100:
        missing_sections = [
            name for name, aliases in _SECTION_HEADERS.items() if not any(a in lower for a in aliases)
        ]
        tips.append(f"Add clearly labeled sections for: {', '.join(missing_sections)}.")
    if word_count < 150:
        tips.append("Resume looks very short for ATS parsing — add more detail to your experience.")
    elif word_count > 1200:
        tips.append("Resume looks long — consider trimming to the most relevant experience.")

    return {"ats_score": overall, "ats_tips": tips}
