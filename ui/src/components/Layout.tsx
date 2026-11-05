import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../session.tsx";

export function Layout() {
  const { user, catalog } = useSession();
  const navigate = useNavigate();
  const role = user?.role;
  const links =
    role === "admin"
      ? [
          { to: "/admin", label: "Dashboard", icon: "📊", end: true },
          { to: "/admin/fleet", label: "Fleet", icon: "🏗️" },
          { to: "/admin/team", label: "Team", icon: "👷" },
          { to: "/admin/pricing", label: "Pricing", icon: "₹" },
          { to: "/account", label: "Account", icon: "👤" },
        ]
      : role === "operator"
        ? [
            { to: "/operator", label: "My jobs", icon: "🧰", end: true },
            { to: "/account", label: "Account", icon: "👤" },
          ]
        : [
            { to: "/", label: "Home", icon: "🏠", end: true },
            { to: "/book", label: "Book", icon: "🏗️" },
            { to: "/bookings", label: "Bookings", icon: "📋" },
            { to: user ? "/account" : "/login", label: user ? "Account" : "Sign in", icon: "👤" },
          ];

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate(role === "admin" ? "/admin" : role === "operator" ? "/operator" : "/")}>
          <span className="brand__mark" aria-hidden>
            ▲
          </span>
          <span>
            <strong>CraneGo</strong>
            <small>{catalog?.business.name ?? "Sri Venkateswara Crane Service"}</small>
          </span>
        </button>
        <nav className="topnav" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="bottomnav" aria-label="Main">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <span aria-hidden>{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
