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
			<h1
				className="mb-3 text-3xl font-bold"
				style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
			>
				{t("photo_upload_title")}
			</h1>
			<p className="mb-8 max-w-xl text-[var(--text-secondary)] leading-relaxed">
				{t("photo_upload_description")}
			</p>

			{/* Photo grid */}
			<div className="mb-6 flex flex-wrap gap-4">
				{photos.map((photo) => (
					<div key={photo.id} className="group relative w-32 shrink-0">
						<img
							src={photo.previewUrl}
							alt={`Photo ${photo.id}`}
							className="h-32 w-32 rounded-lg border border-[var(--border)] object-cover"
						/>
						<button
							type="button"
							onClick={() => removePhoto(photo.id)}
							className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
						>
							×
						</button>
					</div>
				))}

				{/* Add button */}
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] text-2xl text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
				<p className="mb-4 text-sm text-[var(--text-secondary)]">
					{t("photo_count", { count: photos.length })}
				</p>
			)}

			{/* Submit button */}
			<button
				type="button"
				onClick={handleSubmit}
				disabled={status === "submitting" || photos.length === 0}
				className="rounded-md bg-[var(--accent)] px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{status === "submitting" ? t("photo_submitting") : t("photo_submit")}
			</button>

			{/* Status message */}
			<p className="mt-4 min-h-[20px] text-sm italic text-[var(--text-secondary)]">
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
