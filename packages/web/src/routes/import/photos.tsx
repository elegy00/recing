import { createFileRoute } from "@tanstack/react-router";
import PhotoUploadPage from "../../pages/PhotoUploadPage";

export const Route = createFileRoute("/import/photos")({
	component: PhotoUploadPage,
});
