interface PhotoItem {
	id: string;
	previewUrl: string;
}

import { useTranslation } from "react-i18next";

interface Props {
	photos: PhotoItem[];
	onAddClick: () => void;
	onRemoveClick: (id: string) => void;
	disabledSubmit: boolean;
	onSubmit: () => void;
	status: "idle" | "submitting" | "submitted" | "error";
	errorMsg: string | null;
}

export function PhotoUpload({
	photos,
	onAddClick,
	onRemoveClick,
	disabledSubmit,
	onSubmit,
	status,
	errorMsg,
}: Props) {
	const { t } = useTranslation();

	return (
		<div>
			<div className="mb-6 flex flex-wrap gap-4">
				{photos.map((photo) => (
					<PhotoItemCard
						key={photo.id}
						previewUrl={photo.previewUrl}
						onRemove={() => onRemoveClick(photo.id)}
					/>
				))}
				<button
					type="button"
					onClick={onAddClick}
					className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] text-4xl font-light text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:h-40 sm:w-40"
				>
					+
				</button>
			</div>

			{photos.length > 0 && (
				<p className="mb-4 text-base text-[var(--text-secondary)]">
					{t("photo_count", { count: photos.length })}
				</p>
			)}

			<button
				type="button"
				onClick={onSubmit}
				disabled={disabledSubmit || photos.length === 0}
				className="btn-primary px-8 py-3.5 text-lg"
			>
				{status === "submitting" ? t("photo_submitting") : t("photo_submit")}
			</button>

			<p className="mt-4 min-h-[24px] text-base italic text-[var(--text-secondary)]">
				{status === "error" && errorMsg && (
					<span>
						{t("error_prefix")} {errorMsg}
					</span>
				)}
			</p>
		</div>
	);
}

function PhotoItemCard({
	previewUrl,
	onRemove,
}: {
	previewUrl: string;
	onRemove: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="relative w-36 shrink-0 sm:w-40">
			<img
				src={previewUrl}
				alt=""
				className="h-36 w-36 rounded-xl border border-[var(--border)] object-cover sm:h-40 sm:w-40"
			/>
			<button
				type="button"
				onClick={onRemove}
				aria-label={t("photo_remove")}
				className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#9c3f2e] text-lg leading-none text-white shadow-md transition-colors hover:bg-[#833325]"
			>
				×
			</button>
		</div>
	);
}
