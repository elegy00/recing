import { NavLink } from "react-router-dom";

export default function Header() {
  return (
    <header className="header">
      <NavLink to="/" className="logo">Recing</NavLink>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Submit</NavLink>
        <NavLink to="/recipes" className={({ isActive }) => (isActive ? "active" : "")}>Recipes</NavLink>
      </nav>
    </header>
  );
}
