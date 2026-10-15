import { useTranslation } from "react-i18next";
import { Spinner } from "../../atoms/spinner/Spinner";

interface Props {
	url: string;
	onUrlChange: (url: string) => void;
	status: "idle" | "submitting" | "submitted" | "error";
	errorMsg: string | null;
	onSubmit: () => void;
}

export function SubmitForm({
	url,
	onUrlChange,
	status,
	errorMsg,
	onSubmit,
}: Props) {
	const { t } = useTranslation();

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit();
			}}
		>
			<div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
				<input
					type="url"
					placeholder={t("submit_placeholder")}
					value={url}
					onChange={(e) => onUrlChange(e.target.value)}
					// biome-ignore lint/a11y/noAutofocus: deliberate — the URL field is the single primary action on this page
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

			<p className="mt-4 min-h-[24px] text-base italic text-[var(--text-secondary)]">
				{status === "idle" && t("submit_status_idle")}
				{status === "submitting" && (
					<>
						<Spinner className="mr-2" />
						{t("submit_status_submitting")}
					</>
				)}
				{status === "submitted" && t("submit_status_submitted")}
				{status === "error" && errorMsg && (
					<span>
						{t("error_prefix")} {errorMsg}
					</span>
				)}
			</p>
		</form>
	);
}
