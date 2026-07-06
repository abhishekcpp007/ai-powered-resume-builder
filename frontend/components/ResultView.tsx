import { useState } from "react";
import { downloadBlob, exportResume, generateCoverLetter, TailorResponse } from "@/lib/api";
import DiffView from "@/components/DiffView";
import ErrorBanner from "@/components/ErrorBanner";

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col items-center">
      <div className={`text-4xl font-bold ${color}`}>{score}%</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function KeywordPills({ keywords, tone }: { keywords: string[]; tone: "matched" | "missing" }) {
  if (keywords.length === 0) {
    return <p className="text-xs text-slate-400">None</p>;
  }
  const classes =
    tone === "matched"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map((kw) => (
        <span key={kw} className={`rounded-full border px-2 py-0.5 text-xs ${classes}`}>
          {kw}
        </span>
      ))}
    </div>
  );
}

export default function ResultView({
  result,
  jobDescription,
}: {
  result: TailorResponse;
  jobDescription: string;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const resume = result.tailored_resume;

  async function handleDownload(format: "txt" | "docx" | "pdf") {
    setDownloading(format);
    setDownloadError(null);
    try {
      const blob = await exportResume(format, resume);
      downloadBlob(blob, `tailored_resume.${format}`);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleGenerateCoverLetter() {
    setCoverLetterLoading(true);
    setCoverLetterError(null);
    try {
      const text = await generateCoverLetter(jobDescription, resume);
      setCoverLetter(text);
    } catch (e) {
      setCoverLetterError(e instanceof Error ? e.message : "Cover letter generation failed.");
    } finally {
      setCoverLetterLoading(false);
    }
  }

  function handleDownloadCoverLetter() {
    if (!coverLetter) return;
    downloadBlob(new Blob([coverLetter], { type: "text/plain" }), "cover_letter.txt");
  }

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex gap-6">
          <ScoreRing score={result.match_score} label="JD Match Score" />
          <ScoreRing score={result.ats_score} label="ATS Score" />
        </div>
        <div className="flex gap-2">
          {(["txt", "docx", "pdf"] as const).map((format) => (
            <button
              key={format}
              onClick={() => handleDownload(format)}
              disabled={downloading !== null}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {downloading === format ? "Preparing…" : `Download .${format}`}
            </button>
          ))}
        </div>
      </div>

      {downloadError && <ErrorBanner message={downloadError} onDismiss={() => setDownloadError(null)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Matched keywords</h3>
          <KeywordPills keywords={result.matched_keywords} tone="matched" />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Missing keywords</h3>
          <KeywordPills keywords={result.missing_keywords} tone="missing" />
        </div>
      </div>

      {result.ats_tips.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">ATS tips</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {result.ats_tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <button
          onClick={() => setShowDiff((v) => !v)}
          className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
        >
          {showDiff ? "Hide changes" : "Show what changed"}
        </button>
        {showDiff && (
          <div className="mt-2">
            <DiffView diff={result.diff} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-700">Cover Letter</h3>
          <div className="flex gap-2">
            {coverLetter && (
              <button
                onClick={handleDownloadCoverLetter}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Download .txt
              </button>
            )}
            <button
              onClick={handleGenerateCoverLetter}
              disabled={coverLetterLoading}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {coverLetterLoading ? "Generating…" : coverLetter ? "Regenerate" : "Generate Cover Letter"}
            </button>
          </div>
        </div>
        {coverLetterError && (
          <div className="mt-2">
            <ErrorBanner message={coverLetterError} onDismiss={() => setCoverLetterError(null)} />
          </div>
        )}
        {coverLetter && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800">{coverLetter}</p>
        )}
      </div>

      <div className="space-y-5 border-t border-slate-100 pt-5">
        {(resume.name || resume.contact) && (
          <div>
            {resume.name && <h2 className="text-lg font-bold text-slate-900">{resume.name}</h2>}
            {resume.contact && <p className="text-sm text-slate-500">{resume.contact}</p>}
          </div>
        )}

        {resume.summary && (
          <section>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
            <p className="text-sm leading-relaxed text-slate-800">{resume.summary}</p>
          </section>
        )}

        {resume.skills.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Skills</h3>
            <p className="text-sm text-slate-800">{resume.skills.join(", ")}</p>
          </section>
        )}

        {resume.experience.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Experience</h3>
            <div className="space-y-4">
              {resume.experience.map((job, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {job.title}
                      {job.company ? ` — ${job.company}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[job.location, job.dates].filter(Boolean).join(" | ")}
                    </p>
                  </div>
                  {job.bullets.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                      {job.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {resume.education.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Education</h3>
            <div className="space-y-1">
              {resume.education.map((edu, i) => (
                <p key={i} className="text-sm text-slate-800">
                  {[edu.degree, edu.school].filter(Boolean).join(" — ")}
                  {edu.dates ? ` (${edu.dates})` : ""}
                </p>
              ))}
            </div>
          </section>
        )}

        {resume.other_sections.map((section, i) => (
          <section key={i}>
            {section.heading && (
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {section.heading}
              </h3>
            )}
            {section.content && (
              <p className="whitespace-pre-line text-sm text-slate-800">{section.content}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
