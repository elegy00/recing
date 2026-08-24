import { useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { submitRecipe } from "../api/server-functions";

type Status = "idle" | "submitting" | "submitted" | "error";

export default function SubmitPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus("submitting");
    setErrorMsg(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
      await (submitRecipe as any)({ data: { url: url.trim() } });
      setStatus("submitted");
      inputRef.current?.blur();
      setTimeout(() => navigate({ to: "/recipes" }), 600);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1
        className="mb-3 text-3xl font-bold"
        style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
      >
        SUBMIT A RECIPE URL
      </h1>
      <p className="mb-8 max-w-xl text-[var(--text-secondary)] leading-relaxed">
        Paste the URL of any recipe and we'll extract all details using our local AI model.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-sm">
          <input
            ref={inputRef}
            type="url"
            placeholder="https://example.com/chocolate-cake"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            className="flex-1 border-none bg-transparent px-2 py-1 text-[var(--text-primary)] outline-none placeholder:text-[#b0aea9] placeholder:italic"
          />
          <button
            type="submit"
            disabled={status === "submitting" || !url.trim()}
            className="shrink-0 whitespace-nowrap rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
          >
            Submit →
          </button>
        </div>
      </form>

      <p className="mt-4 min-h-[20px] text-sm italic text-[var(--text-secondary)]">
        {status === "idle" && "Status: idle — enter a URL above to begin extraction"}
        {status === "submitting" && (
          <>
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
            Submitting...
          </>
        )}
        {status === "submitted" && "✓ Submitted! Redirecting..."}
        {status === "error" && errorMsg}
      </p>
    </div>
  );
}
