import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route — moved to /import/queue. */
export const Route = createFileRoute("/ingest/")({
	beforeLoad: () => {
		throw redirect({ to: "/import/queue" });
	},
});
