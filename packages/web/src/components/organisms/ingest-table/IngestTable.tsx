import { useTranslation } from "react-i18next";
import type { IngestRow } from "../../../utils/ingest-rows";
import { RetryButton } from "../../atoms/button/RetryButton";
import { StatusBadge } from "../../molecules/status-badge/StatusBadge";

interface Props {
	rows: IngestRow[];
	/** Ids of rows whose retry request is in flight. */
	retryingIds: ReadonlySet<string>;
	/** Called when the user clicks retry on a FAILED row. */
	onRetry: (row: IngestRow) => void;
}

export function IngestTable({ rows, retryingIds, onRetry }: Props) {
	if (rows.length === 0) return <EmptyState />;

	return (
		<>
			{/* Desktop: table */}
			<div className="card hidden overflow-hidden sm:block">
				<IngestTableDesktop
					rows={rows}
					retryingIds={retryingIds}
					onRetry={onRetry}
				/>
			</div>
			{/* Mobile: stacked cards (the table overflows at phone width) */}
			<ul className="space-y-3 sm:hidden">
				{rows.map((row) => (
					<IngestCardMobile
						key={row._id}
						row={row}
						isRetrying={retryingIds.has(row._id)}
						onRetry={() => onRetry(row)}
					/>
				))}
			</ul>
		</>
	);
}

function IngestTableDesktop({ rows, retryingIds, onRetry }: Props) {
	const { t } = useTranslation();
	return (
		<table className="w-full text-base">
			<thead className="bg-[var(--olive-soft)]/60">
				<tr className="border-b border-[var(--border)] text-left text-sm uppercase tracking-wider text-[var(--text-secondary)]">
					<th className="px-5 py-3.5 font-medium">{t("ingest_url")}</th>
					<th className="w-48 px-5 py-3.5 font-medium">
						{t("ingest_status")}
					</th>
					<th className="px-6 py-3.5 text-right">
						{t("ingest_submitted")}
					</th>
					<th className="px-5 py-3.5 text-right">{t("ingest_actions")}</th>
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<IngestRowCard
						key={row._id}
						{...row}
						isRetrying={retryingIds.has(row._id)}
						onRetry={() => onRetry(row)}
					/>
				))}
			</tbody>
		</table>
	);
}

function IngestRowCard({
	source,
	displayName,
	status,
	timeLabel,
	error,
	isRetrying,
	onRetry,
}: IngestRow & { isRetrying: boolean; onRetry: () => void }) {
	const { t } = useTranslation();
	return (
		<tr className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--accent-soft)]/40">
			<td className="max-w-xs px-5 py-3.5 align-top text-[var(--text-primary)]">
				<p className="truncate">
					{source === "photo" && (
						<span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--fig)]" />
					)}
					{displayName}
				</p>
				{error && (
					<p className="mt-0.5 truncate text-xs text-[#8c3a2b]">{error}</p>
				)}
			</td>
			<td className="px-5 py-3.5">
				<StatusBadge status={status} />
			</td>
			<td className="px-6 py-3.5 text-right tabular-nums text-[var(--text-secondary)]">
				{timeLabel}
			</td>
			<td className="px-5 py-3.5 text-right">
				{status === "FAILED" && (
					<RetryButton
						label={t("ingest_retry")}
						loading={isRetrying}
						onClick={onRetry}
					/>
				)}
			</td>
		</tr>
	);
}

function IngestCardMobile({
	row,
	isRetrying,
	onRetry,
}: {
	row: IngestRow;
	isRetrying: boolean;
	onRetry: () => void;
}) {
	const { t } = useTranslation();
	return (
		<li className="card p-4">
			<div className="flex items-start justify-between gap-3">
				<p className="min-w-0 break-all text-base text-[var(--text-primary)]">
					{row.source === "photo" && (
						<span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--fig)]" />
					)}
					{row.displayName}
				</p>
				<StatusBadge status={row.status} />
			</div>
			{row.error && (
				<p className="mt-1 break-all text-xs text-[#8c3a2b]">{row.error}</p>
			)}
			<div className="mt-3 flex items-center justify-between gap-3">
				<p className="tabular-nums text-sm text-[var(--text-secondary)]">
					{t("ingest_submitted")}: {row.timeLabel}
				</p>
				{row.status === "FAILED" && (
					<RetryButton
						label={t("ingest_retry")}
						loading={isRetrying}
						onClick={onRetry}
					/>
				)
			}
			</div>
		</li>
	);
}

function EmptyState() {
	const { t } = useTranslation();
	return (
		<div className="py-12 text-center text-[var(--text-secondary)]">
			{t("ingest_empty")}
		</div>
	);
}
