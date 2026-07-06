"use client";

import { useState } from "react";
import JdInput from "@/components/JdInput";
import ResumeUpload from "@/components/ResumeUpload";
import ErrorBanner from "@/components/ErrorBanner";
import ResultView from "@/components/ResultView";
import { ApiError, MIN_JD_LENGTH, tailorResume, TailorResponse } from "@/lib/api";

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResponse | null>(null);

  const jdReady = jobDescription.trim().length >= MIN_JD_LENGTH;
  const canSubmit = jdReady && resumeFile !== null && !loading;

  async function handleSubmit() {
    if (!resumeFile) {
      setError("Please upload a resume file first.");
      return;
    }
    if (!jdReady) {
      setError(`Please paste a job description of at least ${MIN_JD_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await tailorResume(resumeFile, jobDescription);
      setResult(response);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Something went wrong while tailoring your resume. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Resume Customizer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste a job description, upload your resume, and get an AI-tailored version instantly.
        </p>
      </header>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ResumeUpload file={resumeFile} onChange={setResumeFile} onError={setError} />
        <JdInput value={jobDescription} onChange={setJobDescription} />

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Tailoring your resume…" : "Tailor my resume"}
        </button>
      </div>

      {result && (
        <div className="mt-8">
          <ResultView result={result} jobDescription={jobDescription} />
        </div>
      )}
    </main>
  );
}
