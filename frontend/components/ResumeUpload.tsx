import { useRef } from "react";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_SIZE_MB = 5;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ResumeUpload({
  file,
  onChange,
  onError,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (!picked) return;

    const lower = picked.name.toLowerCase();
    const validExt = ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (!validExt) {
      onError("Only .pdf and .docx resumes are supported.");
      onChange(null);
      return;
    }
    if (picked.size > MAX_SIZE_MB * 1024 * 1024) {
      onError(`Resume file is too large (max ${MAX_SIZE_MB}MB).`);
      onChange(null);
      return;
    }
    onChange(picked);
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">Resume (PDF or DOCX)</label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500 hover:border-slate-400"
      >
        {file ? (
          <div>
            <p className="font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="mt-2 text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <p>Click to browse or drag & drop a .pdf / .docx file (max {MAX_SIZE_MB}MB)</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
