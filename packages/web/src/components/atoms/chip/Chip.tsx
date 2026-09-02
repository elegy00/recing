interface Props {
	children: React.ReactNode;
	className?: string;
}

export function Chip({ children, className }: Props) {
	return (
		<span
			className={`rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-sm font-medium tabular-nums text-[var(--text-primary)] ${className ?? ""}`}
		>
			{children}
		</span>
	);
}
