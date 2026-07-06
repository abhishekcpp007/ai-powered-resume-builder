import { MIN_JD_LENGTH } from "@/lib/api";

export default function JdInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const tooShort = value.trim().length > 0 && value.trim().length < MIN_JD_LENGTH;

  return (
    <div>
      <label htmlFor="jd-input" className="mb-1.5 block text-sm font-medium text-slate-700">
        Job Description
      </label>
      <textarea
        id="jd-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder="Paste the full job description here..."
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span className={tooShort ? "text-red-600" : ""}>
          {tooShort ? `Add at least ${MIN_JD_LENGTH} characters for a meaningful match.` : " "}
        </span>
        <span>{value.length} chars</span>
      </div>
    </div>
  );
}
