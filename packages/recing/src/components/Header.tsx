import { Link, useLocation } from "@tanstack/react-router";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card-bg)]">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-8 py-4">
        <Link
          to="/"
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
        >
          Recing
        </Link>
        <div className="flex gap-6 text-sm">
          <NavLink to="/" label="Submit" />
          <NavLink to="/recipes" label="Recipes" />
        </div>
      </nav>
    </header>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to === "/" && location.pathname === "");
  return (
    <Link
      to={to}
      className={`relative transition-colors duration-150 hover:text-[var(--text-primary)] ${
        isActive ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
      }`}
    >
      {label}
      {isActive && (
        <span
          className="absolute -bottom-5 left-0 right-0 h-[3px] bg-[var(--accent)]"
        />
      )}
    </Link>
  );
}
