import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
	className?: string;
}

export function PrimaryButton({ children, className, ...props }: Props) {
	return (
		<button
			{...props}
			className={`inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-base font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-deep)] ${className ?? ""}`}
		>
			{children}
		</button>
	);
}
