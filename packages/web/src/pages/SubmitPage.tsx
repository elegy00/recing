import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { submitRecipe } from "../api";

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
      await submitRecipe(url.trim());
      setStatus("submitted");
      inputRef.current?.blur();
      setTimeout(() => navigate("/recipes"), 600);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
    }
  }

  return (
    <div className="container">
      <h1 className="page-title">SUBMIT A RECIPE URL</h1>
      <p className="page-desc">
        Paste the URL of any recipe and we'll extract all details using our local AI model.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-card">
          <input
            ref={inputRef}
            type="url"
            className="url-input"
            placeholder="https://example.com/chocolate-cake"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={status === "submitting" || !url.trim()} className="btn btn-primary">
            Submit →
          </button>
        </div>
      </form>

      <p className="status-msg">
        {status === "idle" && "Status: idle — enter a URL above to begin extraction"}
        {status === "submitting" && (
          <>
            <span className="loading-spinner" /> Submitting...
          </>
        )}
        {status === "submitted" && "✓ Submitted! Redirecting..."}
        {status === "error" && errorMsg}
      </p>
    </div>
  );
}
