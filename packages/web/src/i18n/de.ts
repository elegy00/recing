export default {
	// ── Header ────────────────────────────────────────────────
	nav_submit: "Einreichen",
	nav_recipes: "Rezepte",
	nav_ingest: "Verarbeitung",
	nav_photo_upload: "Foto-Upload",

	// ── Footer ────────────────────────────────────────────────
	footer_terms: "AGB",
	footer_help: "Hilfe",

	// ── SubmitPage ────────────────────────────────────────────
	submit_title: "Rezept-URL einreichen",
	submit_description:
		"Füge die URL eines Rezeits ein und wir extrahieren alle Details mit unserem lokalen KI-Modell.",
	submit_placeholder: "https://beispiel.de/schokoladenkuchen",
	submit_button: "Einreichen →",
	submit_status_idle: "Status: Bereit — füge oben eine URL ein, um zu beginnen",
	submit_status_submitting: "Wird eingereicht …",
	submit_status_submitted: "✓ Eingereicht! Weiterleitung …",
	submit_status_error_prefix: "Fehler:",

	// ── RecipeListPage (Landing) ──────────────────────────────
	recipes_title: "Rezepte",
	recipes_description: "Alle extrahierten Rezepte aus eingereichten URLs.",
	filter_all: "Alle",
	filter_completed: "Erledigt",
	filter_pending: "Ausstehend",
	filter_processing: "Verarbeitung …",
	filter_failed: "Fehlgeschlagen",
	recipes_loading: "Wird geladen …",
	recipes_empty: "Keine Rezepte gefunden. Versuche einen anderen Filter.",
	card_cook: "Kochen",
	card_prep: "Vorbereitung",

	// ── RecipeDetailPage ──────────────────────────────────────
	detail_not_found: "Rezept nicht gefunden",
	detail_not_found_message: "Dieses Rezept konnte nicht gefunden werden.",
	detail_back_to_recipes: "← Zurück zu den Rezepten",
	detail_start_cooking: "Kochen starten",
	detail_prep: "Vorbereitung",
	detail_cook: "Kochen",
	detail_total: "Gesamt",
	detail_servings: "Portionen",
	detail_ingredients: "Zutaten",
	detail_instructions: "Anleitung",
	detail_reprocess: "Rezept erneut verarbeiten",
	detail_delete: "Rezept löschen",

	// ── Cook mode ─────────────────────────────────────────────
	cook_exit: "← Kochmodus beenden",
	cook_step_of: "Schritt {current} von {total}",
	cook_previous: "← Zurück",
	cook_next: "Nächster Schritt →",
	cook_finished: "✓ Fertig!",

	// ── Confirmation modal ────────────────────────────────────
	confirm_delete_title: "Rezept löschen?",
	confirm_delete_message:
		'Dies wird "{name}" endgültig entfernen. Diese Aktion kann nicht rückgängig gemacht werden.',
	confirm_reprocess_title: "Rezept erneut verarbeiten?",
	confirm_reprocess_message:
		'Dies wird "{name}" auf "Ausstehend" zurücksetzen, damit es erneut aus der Quell-URL verarbeitet wird. Die aktuell extrahierten Daten werden gelöscht.',
	confirm_cancel: "Abbrechen",
	confirm_delete_btn: "Löschen",
	confirm_reprocess_btn: "Erneut verarbeiten",

	// ── Toast / generic ───────────────────────────────────────
	delete_failed: "Löschen fehlgeschlagen:",
	reset_failed: "Zurücksetzen fehlgeschlagen:",

	// ── IngestPage ────────────────────────────────────────────
	ingest_title: "Verarbeitung",
	ingest_loading: "Wird geladen …",
	// i18next plurals use key suffixes (_one/_other), not ICU inline syntax
	ingest_job_count_one: "Ein Rezept in Bearbeitung",
	ingest_job_count_other: "{count} Rezepte in Bearbeitung",
	ingest_polling: "Aktualisiert sich automatisch…",
	ingest_url: "URL",
	ingest_status: "Status",
	ingest_submitted: "Eingereicht",
	ingest_empty: "Keine Rezepte in Bearbeitung.",
	ingest_pending: "Ausstehend",
	ingest_processing: "In Verarbeitung…",
	ingest_failed: "Fehlgeschlagen",
	ingest_now: "Gerade eben",

	// ── PhotoUploadPage ───────────────────────────────────────
	photo_upload_title: "Rezept vom Foto einreichen",
	photo_upload_description:
		"Füge 1 oder mehr Fotos von Rezepten ein. Unser KI-Modell extrahiert automatisch alle Zutaten, Anleitungen und Details.",
	photo_count_one: "1 Foto ausgewählt",
	photo_count_other: "{count} Fotos ausgewählt",
	photo_submit: "Einreichen →",
	photo_submitted: "✓ Wird verarbeitet! Weiterleitung …",
	photo_submitting: "Wird eingereicht …",

	// ── Photo detail view ─────────────────────────────────────
	photo_status_pending: "Ausstehend",
	photo_status_expecting: "Wird extrahiert…",
	photo_status_extracted: "Extrahiert",
	photo_status_failed: "Fehlgeschlagen",
} as const;
