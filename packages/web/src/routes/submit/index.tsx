import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route — moved to /import. */
export const Route = createFileRoute("/submit/")({
	beforeLoad: () => {
		throw redirect({ to: "/import" });
	},
});
