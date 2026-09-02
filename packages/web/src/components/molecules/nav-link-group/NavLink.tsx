import { Link, useLocation } from "@tanstack/react-router";

interface Props {
	to: string;
	label: string;
	className?: string;
}

export function NavLink({ to, label, className }: Props) {
	const location = useLocation();
	const isActive = (to === "/" && location.pathname === "/") || location.pathname === to;
	return (
		<Link
			to={to}
			className={`rounded-full px-3 py-1.5 text-base transition-colors duration-150 sm:px-3.5 ${
				isActive ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-deep)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
			} ${className ?? ""}`}
		>
			{label}
		</Link>
	);
}
