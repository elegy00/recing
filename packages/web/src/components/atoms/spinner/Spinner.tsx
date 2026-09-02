interface Props {
	className?: string;
}

/** Small inline loading indicator. */
export function Spinner({ className }: Props) {
	return (
		<span
			aria-hidden="true"
			className={`inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle ${className ?? ""}`}
		/>
	);
}
