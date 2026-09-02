import { useRef } from "react";

interface Props {
	url: string;
	onUrlChange: (url: string) => void;
	status: "idle" | "submitting" | "submitted" | "error";
	errorMsg: string | null;
	onSubmit: () => void;
	submitLabel: string;
	placeholder: string;
	idleMessage?: string;
	submittingMessage?: string;
	submittedMessage?: string;
	errorPrefix?: string;
}

export function SubmitForm({
	url, onUrlChange, status, errorMsg, onSubmit, submitLabel, placeholder,
	idleMessage, submittingMessage, submittedMessage, errorPrefix,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
			<div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				<input
					ref={inputRef}
					type="url"
					placeholder={placeholder}
					value={url}
					onChange={(e) => onUrlChange(e.target.value)}
					autoFocus
					className="min-w-0 flex-1 border-none bg-transparent px-2 py-1.5 text-lg text-[var(--text-primary)] outline-none placeholder:text-[#a89f8f] placeholder:italic"
				/>
				<button type="submit" disabled={status === "submitting" || !url.trim()} className="btn-primary shrink-0 px-7 py-3 text-lg">
					{submitLabel}
				</button>
			</div>

			<p className="mt-4 min-h-[24px] text-base italic text-[var(--text-secondary)]">
				{status === "idle" && idleMessage}
				{status === "submitting" && (
					<>
						<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
						{submittingMessage}
					</>
				)}
				{status === "submitted" && submittedMessage}
				{status === "error" && errorMsg && (
					<span>{errorPrefix ?? ""} {errorMsg}</span>
				)}
			</p>
		</form>
	);
}
