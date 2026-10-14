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
	const { t } = useTranslation();

	if (rows.length === 0) return <EmptyState />;

	return (
		<div className="card overflow-hidden">
			<table className="w-full text-base">
				<thead className="bg-[var(--olive-soft)]/60">
					<tr className="border-b border-[var(--border)] text-left text-sm uppercase tracking-wider text-[var(--text-secondary)]">
						<th className="px-5 py-3.5 font-medium">{t("ingest_url")}</th>
						<th className="w-48 px-5 py-3.5 font-medium">
							{t("ingest_status")}
						</th>
						<th className="px-6 py-3.5 text-right">{t("ingest_submitted")}</th>
						<th className="px-5 py-3.5 text-right">
							{t("ingest_actions")}
						</th>
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
		</div>
	);
}

function IngestRowCard({
	source,
	displayName,
	status,
	timeLabel,
	isRetrying,
	onRetry,
}: IngestRow & { isRetrying: boolean; onRetry: () => void }) {
	const { t } = useTranslation();
	return (
		<tr className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--accent-soft)]/40">
			<td className="max-w-xs truncate px-5 py-3.5 text-[var(--text-primary)]">
				{source === "photo" && (
					<span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--fig)]" />
				)}
				{displayName}
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

function EmptyState() {
	const { t } = useTranslation();
	return (
		<div className="py-12 text-center text-[var(--text-secondary)]">
			{t("ingest_empty")}
		</div>
	);
}
