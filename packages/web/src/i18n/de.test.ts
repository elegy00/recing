import { describe, expect, it } from "vitest";
import i18next from "i18next";
import de from "./de";

// Mirrors the interpolation settings in config.ts. i18next v26 changed the
// default delimiters to {{ }}, so we pin them back to single braces.
const createTestInstance = () => {
	const instance = i18next.createInstance();
	instance.init({
		lng: "de",
		resources: { de: { translation: de } },
		interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
	});
	return instance;
};

describe("i18n German translations", () => {
	it("interpolates simple values", () => {
		const i = createTestInstance();
		expect(i.t("cook_step_of", { current: 2, total: 5 })).toBe(
			"Schritt 2 von 5",
		);
		expect(i.t("confirm_delete_message", { name: "Kuchen" })).toContain(
			'"Kuchen"',
		);
	});

	it("resolves German plurals via key suffixes", () => {
		const i = createTestInstance();
		expect(i.t("photo_count", { count: 1 })).toBe("1 Foto ausgewählt");
		expect(i.t("photo_count", { count: 4 })).toBe("4 Fotos ausgewählt");
		expect(i.t("ingest_job_count", { count: 1 })).toBe(
			"Ein Rezept in Bearbeitung",
		);
		expect(i.t("ingest_job_count", { count: 3 })).toBe(
			"3 Rezepte in Bearbeitung",
		);
	});

	it("contains no ICU syntax (i18next does not support it)", () => {
		const values = Object.values(de);
		for (const value of values) {
			expect(value).not.toMatch(/\{\w+,\s*(plural|select)/);
		}
	});

	it("renders no uninterpolated braces for known dynamic keys", () => {
		const i = createTestInstance();
		const rendered = [
			i.t("cook_step_of", { current: 1, total: 3 }),
			i.t("photo_count", { count: 2 }),
			i.t("ingest_job_count", { count: 2 }),
			i.t("confirm_delete_message", { name: "X" }),
			i.t("confirm_reprocess_message", { name: "X" }),
		];
		for (const text of rendered) {
			expect(text).not.toContain("{");
			expect(text).not.toContain("}");
		}
	});
});
