import { useTranslation } from "react-i18next";
import { OliveSprig } from "./Motifs";

export default function Footer() {
	const { t } = useTranslation();
	return (
		<footer className="mt-20 border-t border-[var(--border)] py-10 text-center">
			<OliveSprig className="mx-auto mb-3 h-5 w-9 text-[var(--olive)]" />
			<p className="text-sm text-[var(--text-secondary)]">
				© {new Date().getFullYear()} Recing · {t("footer_terms")} ·{" "}
				{t("footer_help")}
			</p>
		</footer>
	);
}
