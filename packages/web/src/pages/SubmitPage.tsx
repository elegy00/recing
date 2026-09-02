import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { SubmitForm } from "../components/organisms/submit-form/SubmitForm";
import { submitRecipe } from "../api/server-functions";

type Status = "idle" | "submitting" | "submitted" | "error";

export default function SubmitPage() {
	const { t } = useTranslation();
	const [url, setUrl] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const navigate = useNavigate();

	async function handleSubmit() {
		if (!url.trim()) return;

		setStatus("submitting");
		setErrorMsg(null);

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
			await (submitRecipe as any)({ data: { url: url.trim() } });
			setStatus("submitted");
			setTimeout(() => navigate({ to: "/" }), 600);
		} catch (err) {
			setStatus("error");
			setErrorMsg(err instanceof Error ? err.message : "Submission failed");
		}
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<PageHeader title={t("submit_title")} subtitle={t("submit_description")} />
			<SubmitForm
				url={url} onUrlChange={setUrl} status={status} errorMsg={errorMsg}
				onSubmit={handleSubmit} submitLabel={t("submit_button")} placeholder={t("submit_placeholder")}
				idleMessage={t("submit_status_idle")} submittingMessage={t("submit_status_submitting")}
				submittedMessage={t("submit_status_submitted")} errorPrefix={t("submit_status_error_prefix")}
			/>
		</div>
	);
}
