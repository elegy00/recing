// Initialize i18next BEFORE any component renders (SSR & client)
// This import MUST stay here and cannot be moved or tree-shaken.
import { initI18n } from "../i18n/config";
initI18n();

import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import Footer from "../components/Footer";
import Header from "../components/Header";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Recing · Rezepte extrahieren" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="de" suppressHydrationWarning>
			<head>
				{/* Fonts: single source of truth. Preconnect to both origins so the
            woff2 files (served from gstatic) resolve without an extra RTT.
            display=swap keeps text visible while fonts load. */}
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
				<Header />
				{children}
				<Footer />
				<Scripts />
			</body>
		</html>
	);
}
