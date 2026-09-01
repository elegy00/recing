import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { submitRecipe } from "../api/server-functions";

type Status = "idle" | "submitting" | "submitted" | "error";

export default function SubmitPage() {
	const { t } = useTranslation();
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
			setTimeout(() => navigate({ to: "/" }), 600);
		} catch (err) {
			setStatus("error");
			setErrorMsg(err instanceof Error ? err.message : "Submission failed");
		}
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
				{t("submit_title")}
			</h1>
			<div className="mt-3 h-1 w-16 rounded-full bg-[var(--accent)]" />
			<p className="mt-4 mb-8 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
				{t("submit_description")}
			</p>

			<form onSubmit={handleSubmit}>
				<div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
					<input
						ref={inputRef}
						type="url"
						placeholder={t("submit_placeholder")}
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						autoFocus
						className="min-w-0 flex-1 border-none bg-transparent px-2 py-1.5 text-lg text-[var(--text-primary)] outline-none placeholder:text-[#a89f8f] placeholder:italic"
					/>
					<button
						type="submit"
						disabled={status === "submitting" || !url.trim()}
						className="btn-primary shrink-0 px-7 py-3 text-lg"
					>
						{t("submit_button")}
					</button>
				</div>
			</form>

			<p className="mt-4 min-h-[24px] text-base italic text-[var(--text-secondary)]">
				{status === "idle" && t("submit_status_idle")}
				{status === "submitting" && (
					<>
						<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
						{t("submit_status_submitting")}
					</>
				)}
				{status === "submitted" && t("submit_status_submitted")}
				{status === "error" && errorMsg && (
					<>
						{t("submit_status_error_prefix")} {errorMsg}
					</>
				)}
			</p>
		</div>
	);
}
