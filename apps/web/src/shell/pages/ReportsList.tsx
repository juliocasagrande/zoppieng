import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Report } from "@zoppi/shared";
import { REPORT_STATUS_LABELS, REPORT_STATUS_TONE } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { Card } from "../../shared/components/Card.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Button } from "../../shared/components/Button.js";

export function ReportsListPage() {
  const [reports, setReports] = useState<(Report & { companies?: { legal_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/reports")
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Laudos de Ancoragem</h1>
        <Link to="/app/reports/new">
          <Button>Novo laudo</Button>
        </Link>
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : reports.length === 0 ? (
        <Card>
          <p>Nenhum laudo ainda. Crie o primeiro laudo para gerar o link de campo.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map((r) => (
            <Link key={r.id} to={`/app/reports/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="zp-eyebrow">
                    {r.companies?.legal_name ?? "—"} · {r.report_number ?? "sem número"}
                  </div>
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
