import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Report, ReportStatus } from "@zoppi/shared";
import { REPORT_STATUS_LABELS, REPORT_STATUS_TONE } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { KpiCard } from "../../shared/components/KpiCard.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Skeleton } from "../../shared/components/Skeleton.js";
import { daysUntil, relativeTime, validityLabel, validityTone } from "../../shared/lib/dates.js";

const EXPIRING_WINDOW_DAYS = 30;

const STATUS_ORDER: ReportStatus[] = ["draft", "awaiting_field", "in_review", "changes_requested", "signed", "delivered", "rejected"];

const toneColor: Record<"success" | "warning" | "danger" | "info", string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
};

type ReportWithCompany = Report & { companies?: { legal_name: string } };

export function DashboardPage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<ReportWithCompany[] | null>(null);

  useEffect(() => {
    api.get("/reports").then(setReports);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (!reports) {
    return (
      <div>
        <Skeleton height={34} width={220} style={{ marginBottom: 8 }} />
        <Skeleton height={11} width={320} style={{ marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <Skeleton height={11} width="60%" style={{ marginBottom: 10 }} />
              <Skeleton height={30} width="40%" />
            </Card>
          ))}
        </div>
        <Card>
          <Skeleton height={140} />
        </Card>
      </div>
    );
  }

  const total = reports.length;
  const delivered = reports.filter((r) => r.status === "delivered").length;
  const inProgress = reports.filter((r) => ["draft", "awaiting_field", "in_review", "changes_requested"].includes(r.status)).length;

  const withValidity = reports
    .filter((r) => r.valid_until)
    .map((r) => ({ report: r, days: daysUntil(r.valid_until as string) }));
  const expiring = withValidity.filter(({ days }) => days >= 0 && days <= EXPIRING_WINDOW_DAYS).sort((a, b) => a.days - b.days);
  const expired = withValidity.filter(({ days }) => days < 0);

  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: reports.filter((r) => r.status === status).length,
  }));
  const maxCount = Math.max(1, ...statusCounts.map((s) => s.count));

  const recent = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Olá{firstName ? `, ${firstName}` : ""}</h1>
          <div className="zp-eyebrow" style={{ textTransform: "capitalize" }}>
            {today} · visão geral dos laudos
          </div>
        </div>
        <Link to="/app/reports" style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6 }}>
          Ver todos os laudos
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>

      {total === 0 ? (
        <Card>
          <p>Nenhum laudo ainda. Crie o primeiro laudo para começar a acompanhar seus indicadores aqui.</p>
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 16 }}>
            <KpiCard label="Total de laudos" value={total} tone="info" />
            <KpiCard label="Entregues" value={delivered} tone="success" />
            <KpiCard label="Em andamento" value={inProgress} tone="info" />
            <KpiCard label={`A vencer em ${EXPIRING_WINDOW_DAYS} dias`} value={expiring.length} tone="warning" />
            <KpiCard label="Vencidos" value={expired.length} tone="danger" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 16, alignItems: "stretch" }}>
            <Card>
              <h3 style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", fontWeight: 700, textTransform: "none", letterSpacing: 0, marginBottom: 18 }}>
                Laudos por status
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {statusCounts.map(({ status, count }) => (
                  <div key={status} style={{ display: "grid", gridTemplateColumns: "140px 1fr 34px", alignItems: "center", gap: 12 }}>
                    <span className="zp-eyebrow" style={{ letterSpacing: "0.03em" }}>
                      {REPORT_STATUS_LABELS[status]}
                    </span>
                    <div style={{ background: "var(--color-gray-light)", borderRadius: 5, height: 10, overflow: "hidden" }}>
                      <div
                        style={{
                          width: count === 0 ? 0 : `${Math.max((count / maxCount) * 100, 3)}%`,
                          height: "100%",
                          background: toneColor[REPORT_STATUS_TONE[status]],
                          borderRadius: 5,
                        }}
                      />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", textAlign: "right" }}>{count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                <h3 style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", fontWeight: 700, textTransform: "none", letterSpacing: 0, margin: 0 }}>
                  Laudos a vencer
                </h3>
              </div>
              <div className="zp-eyebrow" style={{ marginBottom: 14 }}>
                Próximos {EXPIRING_WINDOW_DAYS} dias · ajuste o período no sino de notificações
              </div>
              {expiring.length === 0 ? (
                <p className="zp-eyebrow">Nenhum laudo vencendo nesse período.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {expiring.slice(0, 6).map(({ report, days }) => {
                    const tone = validityTone(days);
                    return (
                      <Link
                        key={report.id}
                        to={`/app/reports/${report.id}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 0",
                          borderBottom: "1px solid var(--color-gray-light)",
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{report.name}</div>
                          <div className="zp-eyebrow">{report.companies?.legal_name ?? "—"}</div>
                        </div>
                        <StatusBadge label={validityLabel(days)} tone={tone} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", fontWeight: 700, textTransform: "none", letterSpacing: 0, margin: 0 }}>
                Laudos recentes
              </h3>
              <Link
                to="/app/reports"
                style={{ fontFamily: "var(--font-label)", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                Ver todos
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recent.map((r) => (
                <Link
                  key={r.id}
                  to={`/app/reports/${r.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--color-gray-light)",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="zp-eyebrow">
                      {r.companies?.legal_name ?? "—"} · {r.report_number ?? "sem número"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span className="zp-eyebrow">{relativeTime(r.created_at)}</span>
                    <StatusBadge label={REPORT_STATUS_LABELS[r.status]} tone={REPORT_STATUS_TONE[r.status]} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
