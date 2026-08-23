import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { AnchorPoint, Report, ReportParty } from "@zoppi/shared";
import { PULL_TEST_RESULT_LABELS, PULL_TEST_RESULT_TONE, REPORT_STATUS_LABELS, REPORT_STATUS_TONE } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { Button } from "../../shared/components/Button.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Alert } from "../../shared/components/Alert.js";

interface ReportDetailResponse {
  report: Report;
  parties: ReportParty[];
  anchorPoints: (AnchorPoint & { photos: { id: string; storage_path: string }[] })[];
  fieldLinks: { id: string; status: string; purpose: string; expires_at: string }[];
}

export function ReportDetailPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [data, setData] = useState<ReportDetailResponse | null>(null);
  const [fieldLink, setFieldLink] = useState<{ url: string; qrDataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function reload() {
    api.get(`/reports/${id}`).then(setData);
  }

  useEffect(reload, [id]);

  async function generateLink(purpose: "initial" | "correction") {
    setBusy(true);
    try {
      const result = await api.post(`/reports/${id}/field-links`, { purpose });
      setFieldLink(result);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function requestPdf(kind: "report" | "labels") {
    setBusy(true);
    try {
      await api.post(`/reports/${id}/pdf`, { kind });
      setMessage(`Geração de ${kind === "report" ? "PDF do laudo" : "etiquetas"} solicitada. Atualize em alguns instantes.`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(kind: "report" | "labels") {
    const { url } = await api.get(`/reports/${id}/pdf-url?kind=${kind}`);
    window.open(url, "_blank");
  }

  const isStaff = profile?.role === "zoppi_admin" || profile?.role === "zoppi_engineer";

  async function reviewAction(action: "approve" | "request-changes" | "reject") {
    setBusy(true);
    try {
      await api.post(`/review/${id}/${action}`);
      reload();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p>Carregando…</p>;
  const { report, parties, anchorPoints } = data;
  const contratante = parties.find((p) => p.role === "contratante");
  const contratada = parties.find((p) => p.role === "contratada");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1>{report.name}</h1>
          <div className="zp-eyebrow">{report.report_number}</div>
        </div>
        <StatusBadge label={REPORT_STATUS_LABELS[report.status]} tone={REPORT_STATUS_TONE[report.status]} />
      </div>

      {message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="info">{message}</Alert>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <h3 style={{ fontSize: "0.95rem" }}>Contratante</h3>
          <p>{contratante?.legal_name ?? "—"}</p>
        </Card>
        <Card>
          <h3 style={{ fontSize: "0.95rem" }}>Contratada</h3>
          <p>{contratada?.legal_name ?? "—"}</p>
        </Card>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "0.95rem" }}>Link de campo</h3>
        <p style={{ marginBottom: 12 }}>Envie este link para o técnico preencher os dados em campo (sem necessidade de login).</p>
        <div style={{ display: "flex", gap: 12 }}>
          <Button variant="secondary" disabled={busy} onClick={() => generateLink("initial")}>
            Gerar link inicial
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => generateLink("correction")}>
            Gerar link de correção
          </Button>
        </div>
        {fieldLink && (
          <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
            <img src={fieldLink.qrDataUrl} alt="QR code" style={{ width: 120, height: 120 }} />
            <div>
              <div className="zp-eyebrow">URL</div>
              <input readOnly value={fieldLink.url} style={{ width: 360, padding: 8, border: "1px solid var(--color-gray-light)", borderRadius: 4 }} onFocus={(e) => e.target.select()} />
            </div>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Pontos de ancoragem ({anchorPoints.length})</h3>
        {anchorPoints.length === 0 ? (
          <p className="zp-eyebrow">Aguardando preenchimento em campo.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {anchorPoints.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-gray-light)" }}>
                <span>{p.tag}</span>
                <span>{p.photos.length} foto(s)</span>
                {p.test_result && <StatusBadge label={PULL_TEST_RESULT_LABELS[p.test_result]} tone={PULL_TEST_RESULT_TONE[p.test_result]} />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Documentos</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button variant="outline" disabled={busy} onClick={() => requestPdf("report")}>
            Gerar PDF do laudo
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => requestPdf("labels")}>
            Gerar etiquetas de numeração
          </Button>
          {report.pdf_url && (
            <Button variant="secondary" onClick={() => downloadPdf("report")}>
              Baixar PDF do laudo
            </Button>
          )}
          {report.labels_pdf_url && (
            <Button variant="secondary" onClick={() => downloadPdf("labels")}>
              Baixar etiquetas
            </Button>
          )}
        </div>
      </Card>

      {isStaff && report.status === "in_review" && (
        <Card>
          <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Revisão de engenharia</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <Button disabled={busy} onClick={() => reviewAction("approve")}>
              Aprovar e assinar
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => reviewAction("request-changes")}>
              Solicitar correção
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => reviewAction("reject")}>
              Rejeitar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
