interface IngestRow {
	_id: string;
	source: "url" | "photo";
	displayName: string;
	status: "PENDING" | "PROCESSING" | "FAILED";
	timeLabel: string;
}

export interface IngestTableProps {
	rows: IngestRow[];
	hasData: boolean;
	pollingActive: boolean;
	loading: boolean;
}

export function IngestTable({ rows, hasData }: IngestTableProps) {
	if (!hasData && rows.length === 0) return <EmptyState />;

	return (
		<div className="card overflow-hidden">
			<table className="w-full text-base">
				<thead className="bg-[var(--olive-soft)]/60">
					<tr className="border-b border-[var(--border)] text-left text-sm uppercase tracking-wider text-[var(--text-secondary)]">
						<th className="px-5 py-3.5 font-medium">URL / Titel</th>
						<th className="w-48 px-5 py-3.5 font-medium">Status</th>
						<th className="px-6 py-3.5 text-right text-sm uppercase tracking-wider text-[var(--text-secondary)]">Eingereicht</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<IngestRowCard key={row._id} {...row} />
					))}
				</tbody>
			</table>
			{rows.length === 0 && <EmptyState />}
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

function StatusBadge({ status }: { status: "PENDING" | "PROCESSING" | "FAILED" }) {
	const map = {
		PENDING: "bg-[var(--accent-soft)] text-[var(--accent-deep)]",
		PROCESSING: "bg-[var(--olive-soft)] text-[var(--olive-deep)]",
		FAILED: "bg-[#f0d9d2] text-[#8c3a2b]",
	} as const;
	return (
		<span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${map[status]}`}>
			{(status === "PENDING" || status === "PROCESSING") && (
				<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
			)}
			{status}
		</span>
	);
}

function EmptyState() {
	return <div className="py-12 text-center text-[var(--text-secondary)]">Keine Einträge vorhanden.</div>;
}
