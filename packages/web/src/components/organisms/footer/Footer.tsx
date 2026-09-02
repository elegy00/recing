import { OliveSprig } from "../../Motifs";

interface Props {
	year: number;
	copyrightText: string;
}

export function Footer({ year, copyrightText }: Props) {
	return (
		<footer className="mt-20 border-t border-[var(--border)] py-10 text-center">
			<OliveSprig className="mx-auto mb-3 h-5 w-9 text-[var(--olive)]" />
			<p className="text-sm text-[var(--text-secondary)]">
				© {year} Recing · {copyrightText}
			</p>
		</footer>
	);
}
