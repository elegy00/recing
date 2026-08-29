export default {
	// ── Header ────────────────────────────────────────────────
	nav_submit: "Einreichen",
	nav_recipes: "Rezepte",

	// ── Footer ────────────────────────────────────────────────
	footer_terms: "AGB",
	footer_help: "Hilfe",

	// ── SubmitPage ────────────────────────────────────────────
	submit_title: "REZEPT-URL EINREICHEN",
	submit_description:
		"Füge die URL eines Rezeits ein und wir extrahieren alle Details mit unserem lokalen KI-Modell.",
	submit_placeholder: "https://beispiel.de/schokoladenkuchen",
	submit_button: "Einreichen →",
	submit_status_idle: "Status: Bereit — füge oben eine URL ein, um zu beginnen",
	submit_status_submitting: "Wird eingereicht …",
	submit_status_submitted: "✓ Eingereicht! Weiterleitung …",
	submit_status_error_prefix: "Fehler:",

	// ── RecipeListPage (Landing) ──────────────────────────────
	recipes_title: "REZEPTE",
	recipes_description: "Alle extrahierten Rezepte aus eingereichten URLs.",
	filter_all: "Alle",
	filter_completed: "Erledigt",
	filter_pending: "Ausstehend",
	filter_processing: "Verarbeitung …",
	filter_failed: "Fehlgeschlagen",
	recipes_loading: "Wird geladen …",
	recipes_empty:
		"Keine Rezepte gefunden. {tryFilter, select, other[Versuche einen anderen Filter.]}",
	card_pending: "Ausstehend",
	card_processing: "In Verarbeitung…",
	card_failed: "Fehlgeschlagen",
	card_cook: "Kochen",
	card_prep: "Vorbereitung",

	// ── RecipeDetailPage ──────────────────────────────────────
	detail_not_found: "Rezept nicht gefunden",
	detail_not_found_message: "Dieses Rezept konnte nicht gefunden werden.",
	detail_back_to_recipes: "← Zurück zu den Rezepten",
	detail_start_cooking: "🍳 Kochen starten",
	detail_prep: "Vorbereitung",
	detail_cook: "Kochen",
	detail_total: "Gesamt",
	detail_servings: "Portionen",
	detail_ingredients: "Zutaten",
	detail_instructions: "Anleitung",
	detail_reprocess: "↻ Rezept erneut verarbeiten",
	detail_delete: "🗑 Rezept löschen",

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
} as const;
