import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { OliveSprig } from "./Motifs";

export default function Header() {
	const { t } = useTranslation();
	return (
		<header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
			<nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3.5">
				<Link
					to="/"
					className="flex items-center gap-2.5 font-serif text-2xl font-semibold tracking-tight text-[var(--text-primary)]"
				>
					<OliveSprig className="h-5 w-9 shrink-0 text-[var(--olive)]" />
					Recing
				</Link>
				<div className="flex items-center gap-1 sm:gap-2">
					<NavLink to="/" label={t("nav_recipes")} />
					<NavLink to="/ingest" label={t("nav_ingest")} />
					<NavLink to="/upload" label={t("nav_photo_upload")} />
					<NavLink to="/submit" label={t("nav_submit")} />
				</div>
			</nav>
		</header>
	);
}

function NavLink({ to, label }: { to: string; label: string }) {
	const location = useLocation();
	// Match root path or exact match
	const isActive =
		(to === "/" && location.pathname === "/") || location.pathname === to;
	return (
		<Link
			to={to}
			className={`rounded-full px-3 py-1.5 text-base transition-colors duration-150 sm:px-3.5 ${
				isActive
					? "bg-[var(--accent-soft)] font-medium text-[var(--accent-deep)]"
					: "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
			}`}
		>
			{label}
		</Link>
	);
}
