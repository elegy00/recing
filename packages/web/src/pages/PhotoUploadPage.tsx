import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { PhotoUpload } from "../components/organisms/photo-upload/PhotoUpload";
import { submitPhotoJob } from "../api/server-functions";

type Status = "idle" | "submitting" | "submitted" | "error";

interface PhotoItem {
	id: string;
	dataUri: string;
	previewUrl: string;
}

export default function PhotoUploadPage() {
	const { t } = useTranslation();
	const [photos, setPhotos] = useState<PhotoItem[]>([]);
	const [status, setStatus] = useState<Status>("idle");
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const navigate = useNavigate();

	const fileInputRef = useRef<HTMLInputElement>(null);

	function handleFiles(files: FileList | null) {
		if (!files) return;
		const newPhotos: PhotoItem[] = [];
		Array.from(files).forEach((file) => {
			const reader = new FileReader();
			reader.onload = () => {
				newPhotos.push({ id: crypto.randomUUID(), dataUri: reader.result as string, previewUrl: URL.createObjectURL(file) });
			};
			reader.readAsDataURL(file);
		});
		setTimeout(() => setPhotos((prev) => [...prev, ...newPhotos]), 100);
	}

	function removePhoto(id: string) {
		setPhotos((prev) => prev.filter((p) => p.id !== id));
	}

	async function handleSubmit() {
		if (photos.length === 0) return;
		setStatus("submitting");
		setErrorMsg(null);
		try {
			await (submitPhotoJob as any)({ data: { photos: photos.map((p) => ({ dataUri: p.dataUri })) } });
			setStatus("submitted");
			setTimeout(() => navigate({ to: "/ingest" }), 1000);
		} catch (err) {
			setStatus("error");
			setErrorMsg(err instanceof Error ? err.message : "Submission failed");
		}
	}

	const photoItems = photos.map(({ id, previewUrl }) => ({ id, previewUrl }));

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<PageHeader title={t("photo_upload_title")} subtitle={t("photo_upload_description")} />
			<PhotoUpload
				photos={photoItems} onAddClick={() => fileInputRef.current?.click()}
				onRemoveClick={removePhoto} countLabel={`${photos.length} Foto${photos.length !== 1 ? "s" : ""}`}
				submitLabel={status === "submitting" ? t("photo_submitting") : t("photo_submit")}
				disabledSubmit={status === "submitting"} onSubmit={handleSubmit} status={status} errorMsg={errorMsg}
			/>
			<input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
		</div>
	);
}
