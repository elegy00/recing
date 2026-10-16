import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { submitRecipe } from "../api/recipes";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { ImportTabs } from "../components/molecules/import-tabs/ImportTabs";
import { SubmitForm } from "../components/organisms/submit-form/SubmitForm";

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
			await submitRecipe({ data: { url: url.trim() } });
			setStatus("submitted");
			setTimeout(() => navigate({ to: "/" }), 600);
		} catch (err) {
			setStatus("error");
			setErrorMsg(err instanceof Error ? err.message : "Submission failed");
		}
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<ImportTabs />
			<PageHeader
				title={t("submit_title")}
				subtitle={t("submit_description")}
			/>
			<SubmitForm
				url={url}
				onUrlChange={setUrl}
				status={status}
				errorMsg={errorMsg}
				onSubmit={handleSubmit}
			/>
		</div>
	);
}
