import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { submitPhotoJob } from "../api/photo-jobs";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { ImportTabs } from "../components/molecules/import-tabs/ImportTabs";
import { PhotoUpload } from "../components/organisms/photo-upload/PhotoUpload";

type Status = "idle" | "submitting" | "submitted" | "error";

interface PhotoItem {
	id: string;
	dataUri: string;
	previewUrl: string;
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () =>
			reject(reader.error ?? new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

let idCounter = 0;
function nextId() {
	return `photo-${++idCounter}`;
}

export default function PhotoUploadPage() {
	const { t } = useTranslation();
	const [photos, setPhotos] = useState<PhotoItem[]>([]);
	const [status, setStatus] = useState<Status>("idle");
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const navigate = useNavigate();

	const fileInputRef = useRef<HTMLInputElement>(null);

	// Track current photos so object URLs can be revoked on unmount.
	const photosRef = useRef<PhotoItem[]>([]);
	useEffect(() => {
		photosRef.current = photos;
	}, [photos]);

	useEffect(() => {
		return () => {
			for (const p of photosRef.current) URL.revokeObjectURL(p.previewUrl);
		};
	}, []);

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		try {
			const items = await Promise.all(
				Array.from(files).map(async (file) => ({
					id: nextId(),
					dataUri: await fileToDataUrl(file),
					previewUrl: URL.createObjectURL(file),
				})),
			);
			setPhotos((prev) => [...prev, ...items]);
		} catch (err) {
			console.error("Failed to read files", err);
		}
	}

	function removePhoto(id: string) {
		const target = photos.find((p) => p.id === id);
		if (target) URL.revokeObjectURL(target.previewUrl);
		setPhotos((prev) => prev.filter((p) => p.id !== id));
	}

	async function handleSubmit() {
		if (photos.length === 0) return;
		setStatus("submitting");
		setErrorMsg(null);
		try {
			await submitPhotoJob({
				data: { photos: photos.map((p) => ({ dataUri: p.dataUri })) },
			});
			setStatus("submitted");
			setTimeout(() => navigate({ to: "/import/queue" }), 1000);
		} catch (err) {
			setStatus("error");
			setErrorMsg(err instanceof Error ? err.message : "Submission failed");
		}
	}

	const photoItems = photos.map(({ id, previewUrl }) => ({ id, previewUrl }));

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<ImportTabs />
			<PageHeader
				title={t("photo_upload_title")}
				subtitle={t("photo_upload_description")}
			/>
			<PhotoUpload
				photos={photoItems}
				onAddClick={() => fileInputRef.current?.click()}
				onFiles={handleFiles}
				onRemoveClick={removePhoto}
				disabledSubmit={status === "submitting"}
				onSubmit={handleSubmit}
				status={status}
				errorMsg={errorMsg}
			/>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept="image/*"
				className="hidden"
				onChange={(e) => handleFiles(e.target.files)}
			/>
		</div>
	);
}
