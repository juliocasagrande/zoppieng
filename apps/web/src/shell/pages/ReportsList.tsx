import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Report } from "@zoppi/shared";
import { REPORT_STATUS_LABELS, REPORT_STATUS_TONE } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { Card } from "../../shared/components/Card.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Button } from "../../shared/components/Button.js";
import { Skeleton } from "../../shared/components/Skeleton.js";
import { SearchInput } from "../../shared/components/SearchInput.js";
import { inputStyle } from "../../shared/components/FormField.js";
import { useAuth } from "../AuthContext.js";

const STATUS_OPTIONS = Object.entries(REPORT_STATUS_LABELS);
const STATUS_ORDER = Object.keys(REPORT_STATUS_LABELS);

type SortBy = "recent" | "type" | "issued" | "status";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "type", label: "Tipo" },
  { value: "issued", label: "Data de emissão" },
  { value: "status", label: "Status" },
];

export function ReportsListPage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<(Report & { companies?: { legal_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  useEffect(() => {
    api
      .get("/reports")
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const filteredReports = reports.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (searchTerm) {
      const haystack = [r.name, r.report_number, r.description, r.companies?.legal_name].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  // Reports without an issue date (draft/in review — see reports/routes.ts,
  // valid_until/issued_at are only set once a laudo is actually signed) sort
  // to the end when ordering by emission date instead of clustering at "0".
  const sortedReports = [...filteredReports].sort((a, b) => {
    switch (sortBy) {
      case "type":
        return a.name.localeCompare(b.name, "pt-BR");
      case "issued":
        if (!a.issued_at && !b.issued_at) return 0;
        if (!a.issued_at) return 1;
        if (!b.issued_at) return -1;
        return new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime();
      case "status":
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      case "recent":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Laudos de Ancoragem</h1>
        {profile?.can_create_reports && (
          <Link to="/app/reports/new">
            <Button>Novo laudo</Button>
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, número ou empresa..." />
        <select style={{ ...inputStyle, flex: "0 1 200px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status — todos</option>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select style={{ ...inputStyle, flex: "0 1 200px" }} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Ordenar por: {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <Skeleton height={16} width="40%" style={{ marginBottom: 8 }} />
                <Skeleton height={11} width="25%" />
              </div>
              <Skeleton height={22} width={90} radius={12} />
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <p>Nenhum laudo ainda. Crie o primeiro laudo para gerar o link de campo.</p>
        </Card>
      ) : filteredReports.length === 0 ? (
        <Card>
          <p>Nenhum laudo encontrado para esse filtro.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedReports.map((r) => (
            <Link key={r.id} to={`/app/reports/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="zp-eyebrow">
                    {r.companies?.legal_name ?? "—"} · {r.report_number ?? "sem número"} ·{" "}
                    {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  {r.description && (
                    <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--color-gray)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.description}
                    </p>
                  )}
                </div>
                <StatusBadge label={REPORT_STATUS_LABELS[r.status]} tone={REPORT_STATUS_TONE[r.status]} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
