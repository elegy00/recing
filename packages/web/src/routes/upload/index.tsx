import { createFileRoute } from "@tanstack/react-router";
import PhotoUploadPage from "../../pages/PhotoUploadPage";

export const Route = createFileRoute("/upload/")({ component: App });

function App() {
	return <PhotoUploadPage />;
}
