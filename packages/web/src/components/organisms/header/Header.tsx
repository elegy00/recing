import { Link } from "@tanstack/react-router";
import { OliveSprig } from "../../Motifs";
import { NavLinkGroup } from "../../molecules/nav-link-group/NavLinkGroup";

interface Props {
	links: Array<{ to: string; label: string }>;
}

export function Header({ links }: Props) {
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
				<NavLinkGroup links={links} />
			</nav>
		</header>
	);
}
