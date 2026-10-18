import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route — moved to /import/photos. */
export const Route = createFileRoute("/upload/")({
	beforeLoad: () => {
		throw redirect({ to: "/import/photos" });
	},
});
