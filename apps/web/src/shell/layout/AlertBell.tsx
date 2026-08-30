import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Report } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { daysUntil, validityLabel, validityTone } from "../../shared/lib/dates.js";

const PERIOD_OPTIONS = [7, 15, 30, 60, 90];
const STORAGE_KEY = "zp_alert_period_days";

const toneColor: Record<"success" | "warning" | "danger", string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

export function AlertBell() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<(Report & { companies?: { legal_name: string } })[]>([]);
  const [open, setOpen] = useState(false);
  const [periodDays, setPeriodDays] = useState(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return PERIOD_OPTIONS.includes(stored) ? stored : 30;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [customDays, setCustomDays] = useState("");

  useEffect(() => {
    api
      .get("/reports")
      .then(setReports)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectPeriod(days: number) {
    setPeriodDays(days);
    localStorage.setItem(STORAGE_KEY, String(days));
  }

  function applyCustomDays() {
    const days = Number(customDays);
    if (!Number.isInteger(days) || days <= 0) return;
    selectPeriod(days);
    setCustomDays("");
  }

  const expiring = reports
    .filter((r) => r.valid_until)
    .map((r) => ({ report: r, days: daysUntil(r.valid_until as string) }))
    .filter(({ days }) => days <= periodDays)
    .sort((a, b) => a.days - b.days);

  function goToReport(id: string) {
    setOpen(false);
    navigate(`/app/reports/${id}`);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Laudos a vencer"
        style={{
          position: "relative",
          background: open ? "rgba(255,255,255,0.12)" : "transparent",
          border: "none",
          color: "rgba(255,255,255,0.85)",
          cursor: "pointer",
          padding: 8,
          borderRadius: "var(--radius)",
          display: "flex",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {expiring.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: "var(--color-orange)",
              color: "#fff",
              fontFamily: "var(--font-label)",
              fontWeight: 600,
              fontSize: "0.65rem",
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              border: "2px solid var(--color-navy-dark)",
            }}
          >
            {expiring.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 44, right: 0, width: 380, zIndex: 20 }}>
          <div
            style={{
              position: "absolute",
              top: -7,
              right: 12,
              width: 14,
              height: 14,
              background: "#fff",
              borderLeft: "1px solid var(--color-gray-light)",
              borderTop: "1px solid var(--color-gray-light)",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--color-gray-light)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-elevated)",
              padding: 20,
              color: "var(--color-text)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 700, textTransform: "none", letterSpacing: 0, margin: 0 }}>
                  Laudos a vencer
                </h3>
                {expiring.length > 0 && (
                  <span
                    style={{
                      background: "var(--color-orange)",
                      color: "#fff",
                      fontFamily: "var(--font-label)",
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 5px",
                    }}
                  >
                    {expiring.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                style={{ background: "transparent", border: "none", color: "var(--color-gray)", cursor: "pointer", padding: 4, display: "flex" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="zp-eyebrow" style={{ marginBottom: 14 }}>
              Alerta de vencimento de validade
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {PERIOD_OPTIONS.map((days) => (
                <button
                  key={days}
                  onClick={() => selectPeriod(days)}
                  style={{
                    fontFamily: "var(--font-label)",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    padding: "7px 13px",
                    borderRadius: 16,
                    cursor: "pointer",
                    border: periodDays === days ? "1px solid var(--color-navy)" : "1px solid var(--color-gray-light)",
                    background: periodDays === days ? "var(--color-navy)" : "#fff",
                    color: periodDays === days ? "#fff" : "var(--color-text)",
                  }}
                >
                  {days} dias
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input
                type="number"
                min={1}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyCustomDays();
                }}
                placeholder="Outro (dias)"
                style={{
                  width: 110,
                  padding: "7px 10px",
                  borderRadius: "var(--radius)",
                  border: !PERIOD_OPTIONS.includes(periodDays) ? "1px solid var(--color-navy)" : "1px solid var(--color-gray-light)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8rem",
                }}
              />
              <button
                onClick={applyCustomDays}
                style={{
                  fontFamily: "var(--font-label)",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  padding: "7px 13px",
                  borderRadius: 16,
                  cursor: "pointer",
                  border: "1px solid var(--color-gray-light)",
                  background: "#fff",
                  color: "var(--color-text)",
                }}
              >
                Aplicar
              </button>
              {!PERIOD_OPTIONS.includes(periodDays) && (
                <span className="zp-eyebrow" style={{ color: "var(--color-navy)" }}>
                  {periodDays} dias
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", maxHeight: 320, overflowY: "auto" }}>
              {expiring.length === 0 ? (
                <p className="zp-eyebrow" style={{ padding: "8px 0" }}>
                  Nenhum laudo vencendo nos próximos {periodDays} dias.
                </p>
              ) : (
                expiring.map(({ report, days }) => {
                  const tone = validityTone(days);
                  return (
                    <div
                      key={report.id}
                      onClick={() => goToReport(report.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--color-gray-light)",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{report.name}</div>
                        <div className="zp-eyebrow">{report.companies?.legal_name ?? "—"}</div>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontFamily: "var(--font-label)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          fontSize: "0.68rem",
                          letterSpacing: "0.05em",
                          whiteSpace: "nowrap",
                          color: toneColor[tone],
                          background: `color-mix(in srgb, ${toneColor[tone]} 8%, white)`,
                          border: `1px solid color-mix(in srgb, ${toneColor[tone]} 25%, white)`,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: toneColor[tone] }} />
                        {validityLabel(days)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <Link
              onClick={() => setOpen(false)}
              to="/app/reports"
              style={{
                display: "block",
                textAlign: "center",
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--color-gray-light)",
                fontFamily: "var(--font-label)",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Ver todos os laudos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
