import { createFileRoute } from "@tanstack/react-router";
import RecipeListPage from "../pages/RecipeListPage";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return <RecipeListPage />;
}
