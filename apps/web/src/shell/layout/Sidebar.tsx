import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { REPORT_NAME_PRESETS } from "@zoppi/shared";
import { useAuth } from "../AuthContext.js";

// A cascade child can itself expand into more children (see "Engenheiros"
// below) — `to` is only set on leaves that actually navigate somewhere.
interface NavChild {
  to?: string;
  label: string;
  children?: NavChild[];
  // Restricts a single cascade leaf/group without gating the whole parent
  // item — e.g. "Cadastro" stays visible to zoppi_engineer, but its
  // Clientes/Fornecedores/Prestadores children (company business data) don't.
  roles?: string[];
  // Same hairline-divider hint as NavItem.group, one level down — see
  // CADASTRO_CHILDREN.
  group?: string;
}

// Purely a rendering hint: a labeled hairline divider is drawn whenever this
// changes from the previous *visible* item, so related items read as one
// cluster. "home" has no label — it's always the very first item, so the
// divider/header never actually fires for it (see NAV_GROUP_LABELS).
type NavGroup = "home" | "reports" | "registry" | "account";

const NAV_GROUP_LABELS: Partial<Record<NavGroup, string>> = {
  reports: "Laudos",
  registry: "Configuração",
  account: "Conta",
};

interface NavItem {
  // Group-only items (e.g. "Cadastro") have no landing page of their own —
  // clicking the row just expands/collapses it.
  to?: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  requiresReportCreation?: boolean;
  children?: NavChild[];
  group: NavGroup;
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}

// Short display labels for the cascade — the full "Laudo de ..." text (used
// as the report name preset and to match REPORT_NAME_PRESETS) stays in the
// ?preset= query string; only the sidebar label is shortened.
const REPORT_TYPE_SHORT_LABELS = ["Inspeção de pontos de ancoragem", "Instalação de Linha de Vida", "Recertificação de Pontos de Ancoragem"];

// Report-type shortcuts: each one opens the wizard straight to that preset
// (see ReportWizard.tsx reading the ?preset= query param) instead of dumping
// the user on the "choose a name" step to pick it themselves.
const REPORT_TYPE_CHILDREN: NavChild[] = REPORT_NAME_PRESETS.map((preset, i) => ({
  to: `/app/reports/new?preset=${encodeURIComponent(preset)}`,
  label: REPORT_TYPE_SHORT_LABELS[i] ?? preset,
}));

// Master data a subscriber company keeps about its own business — see
// supabase/migrations/0016_registry.sql. "Engenheiros" is the one branch with
// a second cascade level: cadastro data vs. attached documentation, mirroring
// the two-tab layout in RegistryEngineersPage.tsx.
// Clientes/Fornecedores/Prestadores are the subscriber company's own business
// relationships — a zoppi_engineer isn't part of any one company (they serve
// several), so these three don't apply to them and stay hidden. Engenheiros/
// Equipamentos/Veículos are different: those become the engineer's own
// personal records when they create one (see RegistryCrudPage.tsx
// ownershipMode), so they stay visible to everyone.
const CADASTRO_COMPANY_ONLY_ROLES = ["zoppi_admin", "company_admin", "company_operational"];

const CADASTRO_CHILDREN: NavChild[] = [
  { to: "/app/registry/clients", label: "Clientes", roles: CADASTRO_COMPANY_ONLY_ROLES, group: "parceiros" },
  { to: "/app/registry/suppliers", label: "Fornecedores", roles: CADASTRO_COMPANY_ONLY_ROLES, group: "parceiros" },
  { to: "/app/registry/service-providers", label: "Prestadores de Serviço", roles: CADASTRO_COMPANY_ONLY_ROLES, group: "parceiros" },
  {
    label: "Engenheiros",
    group: "recursos",
    children: [
      { to: "/app/registry/engineers", label: "Dados cadastrais" },
      { to: "/app/registry/engineers?tab=documents", label: "Documentação" },
    ],
  },
  { to: "/app/registry/equipment", label: "Equipamentos", group: "recursos" },
  { to: "/app/registry/vehicles", label: "Veículos", group: "recursos" },
  { to: "/app/accessories", label: "Acessórios", group: "catalogo" },
];

// Module-aware by construction: today only "Ancoragem" items exist, but new
// modules add their own entries here (or are derived from active
// module_subscriptions) without touching the shell layout.
const NAV_ITEMS: NavItem[] = [
  {
    to: "/app/dashboard",
    label: "Início",
    group: "home",
    icon: (
      <Icon>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9 22V12h6v10" />
      </Icon>
    ),
  },
  {
    to: "/app/reports",
    label: "Laudos",
    group: "reports",
    icon: (
      <Icon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
      </Icon>
    ),
    requiresReportCreation: true,
    children: REPORT_TYPE_CHILDREN,
  },
  {
    to: "/app/review",
    label: "Fila de revisão",
    group: "reports",
    icon: (
      <Icon>
        <path d="M9 11l3 3 8-8" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </Icon>
    ),
    roles: ["zoppi_admin", "zoppi_engineer"],
  },
  {
    label: "Cadastro",
    group: "registry",
    icon: (
      <Icon>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Icon>
    ),
    children: CADASTRO_CHILDREN,
  },
  {
    to: "/app/field-options",
    label: "Tipos e opções de campo",
    group: "registry",
    icon: (
      <Icon>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </Icon>
    ),
  },
  {
    to: "/app/best-practices",
    label: "Boas práticas",
    group: "account",
    icon: (
      <Icon>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </Icon>
    ),
  },
  {
    to: "/app/billing",
    label: "Assinatura",
    group: "account",
    icon: (
      <Icon>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </Icon>
    ),
    roles: ["zoppi_admin", "company_admin"],
  },
  {
    to: "/app/company",
    label: "Empresa",
    group: "account",
    icon: (
      <Icon>
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M3 21h18" />
        <path d="M9 9h1" />
        <path d="M14 9h1" />
        <path d="M9 13h1" />
        <path d="M14 13h1" />
        <path d="M9 21v-4h6v4" />
      </Icon>
    ),
    roles: ["zoppi_admin", "company_admin"],
  },
  {
    to: "/app/profile",
    label: "Meu perfil",
    group: "account",
    icon: (
      <Icon>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </Icon>
    ),
    roles: ["zoppi_admin", "zoppi_engineer"],
  },
];

const linkStyle = (isActive: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 14px",
  borderRadius: "var(--radius)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "0.9rem",
  textDecoration: "none",
  color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
  background: isActive ? "rgba(232,96,32,0.16)" : "transparent",
});

// Cascade children sit on a permanently lighter background (not just on
// active) so the expanded group reads as visually distinct from the other
// top-level sidebar rows. Nested (2nd-level) children get a slightly
// stronger tint so the extra depth stays legible.
const childLinkStyle = (isActive: boolean, depth = 1): React.CSSProperties => ({
  ...linkStyle(isActive),
  fontSize: "0.82rem",
  fontWeight: 500,
  padding: "9px 14px",
  background: isActive ? "rgba(232,96,32,0.22)" : `rgba(255,255,255,${0.07 * depth})`,
});

function ExpandChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// A child that has children of its own renders as another expandable group
// instead of a link — this is what makes "Cadastro" cascade more than one
// level deep (see "Engenheiros" in CADASTRO_CHILDREN above).
function NavChildNode({ child, depth }: { child: NavChild; depth: number }) {
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;

  if (child.children && child.children.length > 0) {
    const isGroupActive = child.children.some((grandchild) => grandchild.to === currentPath);
    const [open, setOpen] = useState(isGroupActive);

    useEffect(() => {
      if (isGroupActive) setOpen(true);
    }, [isGroupActive]);

    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ ...childLinkStyle(isGroupActive, depth), width: "100%", border: "none", cursor: "pointer", justifyContent: "space-between" }}
        >
          <span>{child.label}</span>
          <ExpandChevron open={open} />
        </button>
        {open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2, paddingLeft: 14 }}>
            {child.children.map((grandchild) => (
              <NavChildNode key={grandchild.label} child={grandchild} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // NavLink's own isActive match ignores the query string, but some leaves
  // only differ by e.g. ?preset=/?tab= — compare the full path+search
  // ourselves so only the clicked one stays highlighted.
  const isActive = currentPath === child.to;
  return (
    <NavLink key={child.to} to={child.to ?? "#"} style={childLinkStyle(isActive, depth)}>
      {child.label}
    </NavLink>
  );
}

function filterChildrenByRole(children: NavChild[], role: string | undefined): NavChild[] {
  return children
    .filter((child) => !child.roles || (role && child.roles.includes(role)))
    .map((child) => (child.children ? { ...child, children: filterChildrenByRole(child.children, role) } : child));
}

function flattenPaths(children: NavChild[]): string[] {
  return children.flatMap((child) => {
    const own = child.to ? [child.to.split("?")[0]] : [];
    return child.children ? [...own, ...flattenPaths(child.children)] : own;
  });
}

function NavItemWithChildren({ item }: { item: NavItem }) {
  const location = useLocation();
  const navigate = useNavigate();
  const descendantPaths = item.children ? flattenPaths(item.children) : [];
  const isSectionActive = item.to ? location.pathname.startsWith(item.to) : descendantPaths.some((path) => location.pathname === path);
  const [open, setOpen] = useState(isSectionActive);

  useEffect(() => {
    if (isSectionActive) setOpen(true);
  }, [isSectionActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (item.to && !isSectionActive) navigate(item.to);
        }}
        style={{
          ...linkStyle(isSectionActive),
          width: "100%",
          border: "none",
          cursor: "pointer",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {item.icon}
          {item.label}
        </span>
        <ExpandChevron open={open} />
      </button>
      {open && item.children && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2, paddingLeft: 14 }}>
          {item.children.map((child, index) => (
            <div key={child.label}>
              {/* Same subtle-hairline grouping as the top-level nav (see
                  Sidebar()), one level down — e.g. Cadastro clusters
                  Clientes/Fornecedores/Prestadores apart from
                  Engenheiros/Equipamentos/Veículos. */}
              {index > 0 && child.group && child.group !== item.children![index - 1].group && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "6px 6px" }} />
              )}
              <NavChildNode child={child} depth={1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { profile } = useAuth();
  const items = NAV_ITEMS.filter(
    (item) =>
      (!item.roles || (profile && item.roles.includes(profile.role))) &&
      (!item.requiresReportCreation || profile?.can_create_reports),
  );

  return (
    <nav
      className="zp-sidebar"
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
      <div className="zp-eyebrow zp-sidebar-label" style={{ color: "rgba(255,255,255,0.35)", padding: "0 14px", marginBottom: 12 }}>
        Navegação
      </div>
      {items.map((item, index) => (
        <div key={item.label}>
          {/* Labeled hairline between clusters of related items (report
              workflow, cadastro/config, account) — the label names the
              cluster, the rule fills the rest of the row. */}
          {index > 0 && item.group !== items[index - 1].group && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 14px 6px" }}>
              <span className="zp-eyebrow" style={{ color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                {NAV_GROUP_LABELS[item.group]}
              </span>
              <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.09)" }} />
            </div>
          )}
          {item.children ? (
            <NavItemWithChildren item={{ ...item, children: filterChildrenByRole(item.children, profile?.role) }} />
          ) : (
            <NavLink to={item.to!} style={({ isActive }) => linkStyle(isActive)}>
              {item.icon}
              {item.label}
            </NavLink>
          )}
        </div>
      ))}
    </nav>
  );
}
