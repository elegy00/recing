import { createFileRoute } from "@tanstack/react-router";
import RecipeListPage from "../../pages/RecipeListPage";

export const Route = createFileRoute("/recipes/")({ component: App });

function App() {
  return <RecipeListPage />;
}
