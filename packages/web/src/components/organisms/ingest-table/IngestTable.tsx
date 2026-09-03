import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../molecules/status-badge/StatusBadge";

export interface IngestRow {
	_id: string;
	source: "url" | "photo";
	displayName: string;
	status: "PENDING" | "PROCESSING" | "FAILED";
	/** ISO timestamp; used for ordering. */
	createdAt: string;
	timeLabel: string;
}

export function IngestTable({ rows }: { rows: IngestRow[] }) {
	const { t } = useTranslation();

	if (rows.length === 0) return <EmptyState />;

	return (
		<div className="card overflow-hidden">
			<table className="w-full text-base">
				<thead className="bg-[var(--olive-soft)]/60">
					<tr className="border-b border-[var(--border)] text-left text-sm uppercase tracking-wider text-[var(--text-secondary)]">
						<th className="px-5 py-3.5 font-medium">{t("ingest_url")}</th>
						<th className="w-48 px-5 py-3.5 font-medium">{t("ingest_status")}</th>
						<th className="px-6 py-3.5 text-right">{t("ingest_submitted")}</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<IngestRowCard key={row._id} {...row} />
					))}
				</tbody>
			</table>
		</div>
	);
}

function IngestRowCard({ source, displayName, status, timeLabel }: IngestRow) {
	return (
		<tr className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--accent-soft)]/40">
			<td className="max-w-xs truncate px-5 py-3.5 text-[var(--text-primary)]">
				{source === "photo" && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--fig)]" />}
				{displayName}
			</td>
			<td className="px-5 py-3.5"><StatusBadge status={status} /></td>
			<td className="px-6 py-3.5 text-right tabular-nums text-[var(--text-secondary)]">{timeLabel}</td>
		</tr>
	);
}

function EmptyState() {
	const { t } = useTranslation();
	return <div className="py-12 text-center text-[var(--text-secondary)]">{t("ingest_empty")}</div>;
}
