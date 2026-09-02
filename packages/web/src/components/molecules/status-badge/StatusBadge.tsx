interface Props {
	status: "PENDING" | "PROCESSING" | "FAILED";
}

export function StatusBadge({ status }: Props) {
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
