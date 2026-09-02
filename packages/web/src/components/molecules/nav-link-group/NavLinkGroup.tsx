import { NavLink } from "./NavLink";

interface Props {
	links: Array<{ to: string; label: string }>;
	className?: string;
}

export function NavLinkGroup({ links, className }: Props) {
	return (
		<div className={`flex items-center gap-1 sm:gap-2 ${className ?? ""}`}>
			{links.map((link) => (
				<NavLink key={link.to} {...link} />
			))}
		</div>
	);
}
