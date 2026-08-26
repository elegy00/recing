import { createFileRoute } from "@tanstack/react-router";
import SubmitPage from "../pages/SubmitPage";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return <SubmitPage />;
}
