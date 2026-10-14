import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "../spinner/Spinner";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
	label: string;
	/** Shows a spinner and disables the button while the action is in flight. */
	loading?: boolean;
}

/** Compact outline button for table-row actions. */
export function RetryButton({ label, loading = false, disabled, ...props }: Props) {
	return (
		<button
			{...props}
			disabled={disabled || loading}
			className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border)] bg-transparent px-3 py-1 text-sm font-medium transition-colors duration-150 hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
		>
			{loading && <Spinner />}
			{label}
		</button>
	);
}
