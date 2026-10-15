import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
	className?: string;
}

export function OutlineButton({ children, className, ...props }: Props) {
	return (
		<button
			{...props}
			className={`inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-transparent px-5 py-3 text-base font-medium transition-colors duration-150 hover:bg-[var(--accent-soft)] ${className ?? ""}`}
		>
			{children}
		</button>
	);
}
