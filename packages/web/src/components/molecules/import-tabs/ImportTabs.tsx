import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

const TABS = [
	{ to: "/import", labelKey: "import_tab_url", exact: true },
	{ to: "/import/photos", labelKey: "import_tab_photos", exact: false },
	{ to: "/import/queue", labelKey: "import_tab_queue", exact: false },
] as const;

/** Second-level tab bar for the import section (URL / photos / queue). */
export function ImportTabs() {
	const { t } = useTranslation();
	const { pathname } = useLocation();

	return (
		<nav
			aria-label="Import"
			className="mb-8 flex gap-1 overflow-x-auto border-b border-[var(--border)]"
		>
			{TABS.map((tab) => {
				const active = tab.exact
					? pathname === tab.to
					: pathname.startsWith(tab.to);
				return (
					<Link
						key={tab.to}
						to={tab.to}
						className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-base transition-colors duration-150 ${
							active
								? "border-[var(--accent)] font-medium text-[var(--accent-deep)]"
								: "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
						}`}
					>
						{t(tab.labelKey)}
					</Link>
				);
			})}
		</nav>
	);
}
