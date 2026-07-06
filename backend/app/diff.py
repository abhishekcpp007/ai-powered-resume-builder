import re
from difflib import SequenceMatcher
from typing import List

from .schemas import DiffSpan, ResumeDiff, TailoredResume

_WORD_RE = re.compile(r"\S+|\s+")


def _tokenize(text: str) -> List[str]:
    return _WORD_RE.findall(text or "")


def _word_diff(original: str, tailored: str) -> List[DiffSpan]:
    original_tokens = _tokenize(original)
    tailored_tokens = _tokenize(tailored)
    matcher = SequenceMatcher(a=original_tokens, b=tailored_tokens, autojunk=False)

    spans: List[DiffSpan] = []
    for tag, a_start, a_end, b_start, b_end in matcher.get_opcodes():
        if tag == "equal":
            spans.append(DiffSpan(text="".join(tailored_tokens[b_start:b_end]), kind="same"))
        elif tag == "replace":
            removed = "".join(original_tokens[a_start:a_end])
            added = "".join(tailored_tokens[b_start:b_end])
            if removed:
                spans.append(DiffSpan(text=removed, kind="removed"))
            if added:
                spans.append(DiffSpan(text=added, kind="added"))
        elif tag == "delete":
            spans.append(DiffSpan(text="".join(original_tokens[a_start:a_end]), kind="removed"))
        elif tag == "insert":
            spans.append(DiffSpan(text="".join(tailored_tokens[b_start:b_end]), kind="added"))

    return spans


def compute_diff(original_summary: str, original_skills: List[str], tailored: TailoredResume) -> ResumeDiff:
    summary_spans = _word_diff(original_summary, tailored.summary)

    original_skill_set = {s.strip().lower(): s.strip() for s in original_skills if s.strip()}
    tailored_skill_set = {s.strip().lower(): s.strip() for s in tailored.skills if s.strip()}

    kept_keys = original_skill_set.keys() & tailored_skill_set.keys()
    added_keys = tailored_skill_set.keys() - original_skill_set.keys()
    removed_keys = original_skill_set.keys() - tailored_skill_set.keys()

    return ResumeDiff(
        summary=summary_spans,
        skills_added=sorted((tailored_skill_set[k] for k in added_keys), key=str.lower),
        skills_removed=sorted((original_skill_set[k] for k in removed_keys), key=str.lower),
        skills_kept=sorted((tailored_skill_set[k] for k in kept_keys), key=str.lower),
    )
