// ── i18next initialization ───────────────────────────────────────────────
// This module initializes i18next with German translations.
// Call initI18n() early (in __root.tsx) to ensure it runs before SSR rendering.
import type { Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import i18n from "i18next";

import de from "./de";

// i18next resource format: { [lang]: { [ns]: { [key]: value } } }
// Since we only have German, the top-level key is "de"
const resources: Resource = {
	de: {
		translation: de,
	},
};

let initialized = false;

/**
 * Initialize i18next synchronously.
 * Safe to call multiple times — only initializes once.
 */
export function initI18n(): void {
	if (initialized) return;
	initialized = true;

	i18n.use(initReactI18next).init({
		resources,
		lng: "de",
		fallbackLng: "de",
		defaultNS: "translation",
		ns: ["translation"],
		interpolation: {
			escapeValue: false, // React already escapes
			// i18next v26 changed the default delimiters to "{{ }}"; our
			// translations use single braces, so pin them explicitly.
			prefix: "{",
			suffix: "}",
		},
	});
}
