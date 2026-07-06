import { ResumeDiff } from "@/lib/api";

function SummaryDiff({ spans }: { spans: ResumeDiff["summary"] }) {
  if (spans.length === 0) {
    return <p className="text-xs text-slate-400">No summary changes.</p>;
  }
  return (
    <p className="text-sm leading-relaxed">
      {spans.map((span, i) => {
        if (span.kind === "added") {
          return (
            <span key={i} className="rounded bg-green-100 text-green-800">
              {span.text}
            </span>
          );
        }
        if (span.kind === "removed") {
          return (
            <span key={i} className="rounded bg-red-100 text-red-700 line-through">
              {span.text}
            </span>
          );
        }
        return <span key={i}>{span.text}</span>;
      })}
    </p>
  );
}

function SkillsDiffList({ label, skills, tone }: { label: string; skills: string[]; tone: "added" | "removed" | "kept" }) {
  if (skills.length === 0) return null;
  const classes =
    tone === "added"
      ? "bg-green-50 text-green-700 border-green-200"
      : tone === "removed"
      ? "bg-red-50 text-red-700 border-red-200 line-through"
      : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span key={s} className={`rounded-full border px-2 py-0.5 text-xs ${classes}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DiffView({ diff }: { diff: ResumeDiff }) {
  const hasSkillChanges =
    diff.skills_added.length > 0 || diff.skills_removed.length > 0 || diff.skills_kept.length > 0;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Summary changes
        </h4>
        <SummaryDiff spans={diff.summary} />
      </div>

      {hasSkillChanges && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Skill changes
          </h4>
          <div className="space-y-2">
            <SkillsDiffList label="Added" skills={diff.skills_added} tone="added" />
            <SkillsDiffList label="Removed" skills={diff.skills_removed} tone="removed" />
            <SkillsDiffList label="Kept" skills={diff.skills_kept} tone="kept" />
          </div>
        </div>
      )}
    </div>
  );
}
