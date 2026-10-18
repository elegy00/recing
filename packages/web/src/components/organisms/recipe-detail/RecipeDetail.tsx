import { useTranslation } from "react-i18next";
import { formatDuration } from "../../../utils/formatTime";
import { timeAgo } from "../../../utils/timeAgo";
import type { RecipeIngredient, RecipeStep } from "../../../types";
import { OutlineButton } from "../../atoms/button/OutlineButton";
import { PrimaryButton } from "../../atoms/button/PrimaryButton";
import { Chip } from "../../atoms/chip/Chip";
import { SprigDivider } from "../../Motifs";

interface Props {
	name: string;
	description?: string;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	servings?: number | string;
	/** ISO timestamp of the ingestion job; shown in the footer. */
	createdAt?: string;
	/** Original source URL (http(s) only); rendered as a link. */
	sourceUrl?: string;
	ingredients: RecipeIngredient[];
	instructions: RecipeStep[];
	onStartCooking: () => void;
	onConfirmDelete: () => Promise<void>;
	onConfirmReset: () => Promise<void>;
	onCancelConfirm: () => void;
	onBack: () => void;
	showActions: boolean;
	confirmAction: "delete" | "reset" | null;
}

export function RecipeDetail({
	name,
	description,
	prepTime,
	cookTime,
	totalTime,
	servings,
	createdAt,
	sourceUrl,
	ingredients,
	instructions,
	onStartCooking,
	onConfirmDelete,
	onConfirmReset,
	onCancelConfirm,
	onBack,
	showActions,
	confirmAction,
}: Props) {
	const { t } = useTranslation();

	return (
		<div>
			{/* Header */}
			<div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
						{name}
					</h1>
					<div className="mt-3 h-1 w-16 rounded-full bg-[var(--accent)]" />
					{description && (
						<p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)]">
							{description}
						</p>
					)}
					{sourceUrl && sourceUrl.startsWith("http") && (
						<a
							href={sourceUrl}
							target="_blank"
							rel="noreferrer"
							className="mt-2 inline-block text-sm text-[var(--accent)] underline underline-offset-2 transition-colors hover:text-[var(--accent-deep)]"
						>
							{t("detail_source")}
						</a>
					)}
				</div>
				<PrimaryButton onClick={onStartCooking}>
					{t("detail_start_cooking")}
				</PrimaryButton>
			</div>

			{/* Meta chips */}
			{(prepTime || cookTime || totalTime || servings) && (
				<div className="mb-10 flex flex-wrap gap-2.5">
					{prepTime && (
						<Chip>
							{t("detail_prep")}: {formatDuration(prepTime)}
						</Chip>
					)}
					{cookTime && (
						<Chip>
							{t("detail_cook")}: {formatDuration(cookTime)}
						</Chip>
					)}
					{totalTime && !prepTime && !cookTime && (
						<Chip>
							{t("detail_total")}: {formatDuration(totalTime)}
						</Chip>
					)}
					{servings && <Chip>{servings}</Chip>}
				</div>
			)}

			{/* Ingredients */}
			<h2 className="mb-5 font-serif text-3xl font-semibold">
				{t("detail_ingredients")}
			</h2>
			<ul className="mb-10 grid list-none gap-x-10 gap-y-2.5 sm:grid-cols-2">
				{ingredients.map((ing, idx) => {
					// biome-ignore lint/suspicious/noArrayIndexKey: static list that never reorders
					return <IngredientItem key={idx} {...ing} />;
				})}
			</ul>

			<SprigDivider className="mb-10" />

			{/* Instructions */}
			<h2 className="mb-5 font-serif text-3xl font-semibold">
				{t("detail_instructions")}
			</h2>
			<ol className="list-decimal space-y-4 pl-6 marker:font-serif marker:text-xl marker:font-semibold marker:text-[var(--accent)]">
				{instructions.map((step) => (
					<li key={step.stepNumber} className="text-lg leading-relaxed">
						{step.text}
						{step.timer && (
							<span className="ml-2 inline-block rounded-full bg-[var(--olive-soft)] px-3 py-0.5 text-sm font-medium tabular-nums text-[var(--olive-deep)]">
								⏱ {formatDuration(step.timer)}
							</span>
						)}
					</li>
				))}
			</ol>

			{/* Footer date */}
			{createdAt && (
				<div className="mt-10 border-t border-[var(--border)] pt-5">
					<p className="text-sm text-[var(--text-secondary)]">
						{t("detail_added")}: {timeAgo(createdAt)}
					</p>
				</div>
			)}

			{/* Action buttons */}
			{showActions && (
				<div className="mt-6 flex flex-wrap gap-3">
					<OutlineButton onClick={onConfirmReset}>
						{t("detail_reprocess")}
					</OutlineButton>
					<button
						type="button"
						onClick={onConfirmDelete}
						className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c98a7d] bg-transparent px-5 py-3 text-base font-medium text-[#9c3f2e] transition-colors duration-150 hover:bg-[#f6e3dc]"
					>
						{t("detail_delete")}
					</button>
				</div>
			)}

			<OutlineButton onClick={onBack} className="mt-4">
				{t("detail_back_to_recipes")}
			</OutlineButton>

			{/* Confirmation modal */}
			{confirmAction && (
				<ConfirmModal
					name={name}
					action={confirmAction}
					onConfirm={() =>
						confirmAction === "delete" ? onConfirmDelete() : onConfirmReset()
					}
					onCancel={onCancelConfirm}
				/>
			)}
		</div>
	);
}

function IngredientItem({ quantity, unit, name, note }: RecipeIngredient) {
	return (
		<li className="text-lg leading-relaxed">
			{quantity && <strong>{quantity} </strong>}
			{unit && <em className="font-serif">{unit} </em>}
			{name}
			{note && <span className="text-[var(--text-secondary)]"> — {note}</span>}
		</li>
	);
}

function ConfirmModal({
	name,
	action,
	onConfirm,
	onCancel,
}: {
	name: string;
	action: "delete" | "reset";
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
			<div className="card w-full max-w-md p-7 shadow-xl">
				<h3 className="mb-2 font-serif text-2xl font-semibold">
					{action === "delete"
						? t("confirm_delete_title")
						: t("confirm_reprocess_title")}
				</h3>
				<p className="mb-6 leading-relaxed text-[var(--text-secondary)]">
					{action === "delete"
						? t("confirm_delete_message", { name })
						: t("confirm_reprocess_message", { name })}
				</p>
				<div className="flex justify-end gap-3">
					<OutlineButton onClick={onCancel}>
						{t("confirm_cancel")}
					</OutlineButton>
					<PrimaryButton
						onClick={() => {
							onConfirm();
							onCancel();
						}}
					>
						{action === "delete"
							? t("confirm_delete_btn")
							: t("confirm_reprocess_btn")}
					</PrimaryButton>
				</div>
			</div>
		</div>
	);
}
