import { NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext.js";

interface NavItem {
  to: string;
  label: string;
  roles?: string[];
}

// Module-aware by construction: today only "Ancoragem" items exist, but new
// modules add their own entries here (or are derived from active
// module_subscriptions) without touching the shell layout.
const NAV_ITEMS: NavItem[] = [
  { to: "/app/reports", label: "Laudos — Ancoragem" },
  { to: "/app/review", label: "Fila de revisão", roles: ["zoppi_admin", "zoppi_engineer"] },
  { to: "/app/accessories", label: "Catálogo de acessórios" },
  { to: "/app/best-practices", label: "Boas práticas" },
  { to: "/app/billing", label: "Assinatura", roles: ["zoppi_admin", "company_admin"] },
  { to: "/app/company", label: "Empresa", roles: ["zoppi_admin", "company_admin"] },
];

export function Sidebar() {
  const { profile } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.roles || (profile && item.roles.includes(profile.role)));

  return (
    <nav
      style={{
        background: "var(--color-navy-dark)",
        width: "var(--sidebar-width)",
        minHeight: "100vh",
        padding: "24px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div className="zp-eyebrow" style={{ color: "rgba(255,255,255,0.35)", padding: "0 14px", marginBottom: 12 }}>
        Navegação
      </div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: "block",
            padding: "11px 14px",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
            color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
            background: isActive ? "rgba(232,96,32,0.16)" : "transparent",
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
