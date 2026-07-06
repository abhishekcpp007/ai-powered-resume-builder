export type ExperienceEntry = {
  title: string;
  company: string;
  dates: string;
  location: string;
  bullets: string[];
};

export type EducationEntry = {
  school: string;
  degree: string;
  dates: string;
};

export type OtherSection = {
  heading: string;
  content: string;
};

export type TailoredResume = {
  name: string;
  contact: string;
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  other_sections: OtherSection[];
};

export type DiffSpan = {
  text: string;
  kind: "same" | "added" | "removed";
};

export type ResumeDiff = {
  summary: DiffSpan[];
  skills_added: string[];
  skills_removed: string[];
  skills_kept: string[];
};

export const MIN_JD_LENGTH = 50;

export type TailorResponse = {
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  tailored_resume: TailoredResume;
  original_summary: string;
  diff: ResumeDiff;
  ats_score: number;
  ats_tips: string[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    return JSON.stringify(data);
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

export async function tailorResume(resumeFile: File, jobDescription: string): Promise<TailorResponse> {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("job_description", jobDescription);

  const res = await fetch(`${API_BASE_URL}/api/tailor`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new ApiError(await readError(res));
  }
  return res.json();
}

export async function exportResume(
  format: "txt" | "docx" | "pdf",
  tailoredResume: TailoredResume
): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, tailored_resume: tailoredResume }),
  });

  if (!res.ok) {
    throw new ApiError(await readError(res));
  }
  return res.blob();
}

export async function generateCoverLetter(
  jobDescription: string,
  tailoredResume: TailoredResume
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/cover-letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_description: jobDescription, tailored_resume: tailoredResume }),
  });

  if (!res.ok) {
    throw new ApiError(await readError(res));
  }
  const data = await res.json();
  return data.cover_letter as string;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
