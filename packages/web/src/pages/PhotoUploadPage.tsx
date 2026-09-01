import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
				const dataUri = reader.result as string;
				newPhotos.push({
					id: crypto.randomUUID(),
					dataUri,
					previewUrl: URL.createObjectURL(file),
				});
			};
			reader.readAsDataURL(file);
		});

		// Wait for all readers to complete (they're async)
		setTimeout(() => {
			setPhotos((prev) => [...prev, ...newPhotos]);
		}, 100);
	}

	function removePhoto(id: string) {
		setPhotos((prev) => prev.filter((p) => p.id !== id));
	}

	async function handleSubmit() {
		if (photos.length === 0) return;

		setStatus("submitting");
		setErrorMsg(null);

		try {
			await (submitPhotoJob as any)({
				data: { photos: photos.map((p) => ({ dataUri: p.dataUri })) },
			});
			setStatus("submitted");
			setTimeout(() => navigate({ to: "/ingest" }), 1000);
		} catch (err) {
			setStatus("error");
			setErrorMsg(err instanceof Error ? err.message : "Submission failed");
		}
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
				{t("photo_upload_title")}
			</h1>
			<div className="mt-3 h-1 w-16 rounded-full bg-[var(--accent)]" />
			<p className="mt-4 mb-8 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
				{t("photo_upload_description")}
			</p>

			{/* Photo grid */}
			<div className="mb-6 flex flex-wrap gap-4">
				{photos.map((photo) => (
					<div key={photo.id} className="relative w-36 shrink-0 sm:w-40">
						<img
							src={photo.previewUrl}
							alt={`Photo ${photo.id}`}
							className="h-36 w-36 rounded-xl border border-[var(--border)] object-cover sm:h-40 sm:w-40"
						/>
						{/* Always visible: iPads have no hover state */}
						<button
							type="button"
							onClick={() => removePhoto(photo.id)}
							aria-label="Foto entfernen"
							className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#9c3f2e] text-lg leading-none text-white shadow-md transition-colors hover:bg-[#833325]"
						>
							×
						</button>
					</div>
				))}

				{/* Add button */}
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] text-4xl font-light text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:h-40 sm:w-40"
				>
					+
				</button>

				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept="image/*"
					className="hidden"
					onChange={(e) => handleFiles(e.target.files)}
				/>
			</div>

			{/* Photo count */}
			{photos.length > 0 && (
				<p className="mb-4 text-base text-[var(--text-secondary)]">
					{t("photo_count", { count: photos.length })}
				</p>
			)}

			{/* Submit button */}
			<button
				type="button"
				onClick={handleSubmit}
				disabled={status === "submitting" || photos.length === 0}
				className="btn-primary px-8 py-3.5 text-lg"
			>
				{status === "submitting" ? t("photo_submitting") : t("photo_submit")}
			</button>

			{/* Status message */}
			<p className="mt-4 min-h-[24px] text-base italic text-[var(--text-secondary)]">
				{status === "submitted" && t("photo_submitted")}
				{status === "error" && errorMsg && (
					<span>
						{t("submit_status_error_prefix")} {errorMsg}
					</span>
				)}
			</p>
		</div>
	);
}
