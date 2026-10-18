// Initialize i18next BEFORE any component renders (SSR & client)
// This import MUST stay here and cannot be moved or tree-shaken.
import { initI18n } from "../i18n/config";

initI18n();

import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Footer } from "../components/organisms/footer/Footer";
import { Header } from "../components/organisms/header/Header";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Recing · Rezepte extrahieren" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { t } = useTranslation();
	return (
		<html lang="de" suppressHydrationWarning>
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600&display=swap"
					rel="stylesheet"
				/>
				<HeadContent />
			</head>
			<body className="antialiased [overflow-wrap:anywhere]">
				<Header
					links={[
						{ to: "/", label: t("nav_recipes") },
						{ to: "/import", label: t("nav_import") },
					]}
				/>
				{children}
				<Footer
					year={new Date().getFullYear()}
					copyrightText={`${t("footer_terms")} · ${t("footer_help")}`}
				/>
				<Scripts />
			</body>
		</html>
	);
}
