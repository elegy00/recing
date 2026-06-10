import { HashRouter, Routes, Route } from "react-router-dom";
import GlobalStyles from "./GlobalStyles";
import Header from "./components/Header";
import SubmitPage from "./pages/SubmitPage";
import RecipeListPage from "./pages/RecipeListPage";

export default function App() {
  return (
    <HashRouter>
      <style>{GlobalStyles}</style>
      <Header />
      <Routes>
        <Route path="/" element={<SubmitPage />} />
        <Route path="/recipes" element={<RecipeListPage />} />
      </Routes>
      <div className="footer">© 2026 Recing · Terms · Help</div>
    </HashRouter>
  );
}
