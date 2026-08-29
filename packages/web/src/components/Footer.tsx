import { useTranslation } from "react-i18next";

export default function Footer() {
	const { t } = useTranslation();
	return (
		<footer className="mt-20 border-t border-[var(--border)] bg-[var(--card-bg)] py-10 text-center text-sm text-[#b0aea9]">
			© {new Date().getFullYear()} Recing · {t("footer_terms")} ·{" "}
			{t("footer_help")}
		</footer>
	);
}
