import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { AnchorPoint, Report, ReportParty } from "@zoppi/shared";
import { PULL_TEST_RESULT_LABELS, PULL_TEST_RESULT_TONE, REPORT_STATUS_LABELS, REPORT_STATUS_TONE } from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { Card } from "../../shared/components/Card.js";
import { Button } from "../../shared/components/Button.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Alert } from "../../shared/components/Alert.js";
import { Skeleton } from "../../shared/components/Skeleton.js";
import { ReviewWizard } from "./ReviewWizard.js";

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
  const [pdfStatus, setPdfStatus] = useState<Record<"report" | "labels", "idle" | "generating" | "error">>({ report: "idle", labels: "idle" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const pollTimeouts = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  function reload() {
    api.get(`/reports/${id}`).then(setData);
  }

  useEffect(reload, [id]);

  useEffect(() => {
    return () => {
      Object.values(pollTimeouts.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

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

  // Forces a real file download (with a sensible filename) instead of just
  // opening the signed URL, which browsers usually preview in a new tab
  // rather than saving.
  async function downloadPdf(kind: "report" | "labels") {
    const { url } = await api.get(`/reports/${id}/pdf-url?kind=${kind}`);
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${kind === "labels" ? "etiquetas" : "laudo"}-${data?.report.report_number ?? id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  const kindLabel = (kind: "report" | "labels") => (kind === "labels" ? "Etiquetas" : "PDF do laudo");

  // Opens the currently-generated report PDF inline (in an <iframe>) instead
  // of forcing a download, so the engineer can review the draft laudo without
  // leaving the page before deciding to approve/sign the final version.
  async function openPreview() {
    const { url } = await api.get(`/reports/${id}/pdf-url?kind=report`);
    const res = await fetch(url);
    const blob = await res.blob();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  // PDF generation is async (a worker job) — poll pdf-status instead of
  // asking the user to manually refresh, then either auto-download or open
  // the inline preview once it's ready, depending on how it was requested.
  function pollPdfStatus(kind: "report" | "labels", mode: "download" | "preview", attempt = 0) {
    api
      .get(`/reports/${id}/pdf-status?kind=${kind}`)
      .then(async (status: { status?: string }) => {
        if (status?.status === "done") {
          setPdfStatus((s) => ({ ...s, [kind]: "idle" }));
          reload();
          if (mode === "preview") {
            setMessage(null);
            await openPreview();
          } else {
            setMessage(`${kindLabel(kind)} pronto — baixando…`);
            await downloadPdf(kind);
          }
          return;
        }
        if (status?.status === "failed") {
          setPdfStatus((s) => ({ ...s, [kind]: "error" }));
          setMessage(`Falha ao gerar ${kindLabel(kind).toLowerCase()}. Tente novamente.`);
          return;
        }
        if (attempt >= 40) {
          setPdfStatus((s) => ({ ...s, [kind]: "error" }));
          setMessage(`A geração de ${kindLabel(kind).toLowerCase()} está demorando mais que o esperado. Tente novamente em instantes.`);
          return;
        }
        pollTimeouts.current[kind] = setTimeout(() => pollPdfStatus(kind, mode, attempt + 1), 2000);
      })
      .catch(() => {
        pollTimeouts.current[kind] = setTimeout(() => pollPdfStatus(kind, mode, attempt + 1), 2000);
      });
  }

  async function requestPdf(kind: "report" | "labels", mode: "download" | "preview" = "download") {
    setBusy(true);
    setMessage(null);
    setPdfStatus((s) => ({ ...s, [kind]: "generating" }));
    try {
      await api.post(`/reports/${id}/pdf`, { kind });
      pollPdfStatus(kind, mode);
    } catch (err) {
      setPdfStatus((s) => ({ ...s, [kind]: "error" }));
      setMessage(err instanceof Error ? err.message : `Erro ao solicitar ${kindLabel(kind).toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  }

  const isStaff = profile?.role === "zoppi_admin" || profile?.role === "zoppi_engineer";

  if (!data) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <Skeleton height={30} width={260} style={{ marginBottom: 8 }} />
            <Skeleton height={11} width={120} />
          </div>
          <Skeleton height={22} width={90} radius={12} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <Card>
            <Skeleton height={13} width="40%" style={{ marginBottom: 10 }} />
            <Skeleton height={16} width="70%" />
          </Card>
          <Card>
            <Skeleton height={13} width="40%" style={{ marginBottom: 10 }} />
            <Skeleton height={16} width="70%" />
          </Card>
        </div>
        <Card style={{ marginBottom: 24 }}>
          <Skeleton height={13} width="30%" style={{ marginBottom: 10 }} />
          <Skeleton height={13} width="80%" style={{ marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 12 }}>
            <Skeleton height={38} width={160} />
            <Skeleton height={38} width={180} />
          </div>
        </Card>
        <Card>
          <Skeleton height={13} width="35%" style={{ marginBottom: 14 }} />
          <Skeleton height={14} width="60%" />
        </Card>
      </div>
    );
  }
  const { report, parties, anchorPoints } = data;
  const contratante = parties.find((p) => p.role === "contratante");
  const contratada = parties.find((p) => p.role === "contratada");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1>{report.name}</h1>
          <div className="zp-eyebrow">
            {report.report_number} · {new Date(report.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </div>
          {report.description && <p style={{ margin: "6px 0 0", maxWidth: 560 }}>{report.description}</p>}
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

      {(report.field_executor_name || report.test_equipment_manufacturer) && (
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Equipamento e responsável em campo</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div>
              <div className="zp-eyebrow">Executante</div>
              <p style={{ margin: "2px 0 0" }}>
                {report.field_executor_name ?? "—"}
                {report.field_executor_role ? ` — ${report.field_executor_role}` : ""}
              </p>
            </div>
            <div>
              <div className="zp-eyebrow">Instrumento de teste</div>
              <p style={{ margin: "2px 0 0" }}>
                {report.test_equipment_manufacturer ?? "—"} {report.test_equipment_model ?? ""}
              </p>
              <p style={{ margin: "2px 0 0", color: "var(--color-gray)" }}>
                {report.test_equipment_serial ? `Nº série ${report.test_equipment_serial}` : ""}
                {report.test_equipment_capacity_kgf ? ` · Capacidade ${report.test_equipment_capacity_kgf} kgf` : ""}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: 4 }}>Pontos de ancoragem ({anchorPoints.length})</h3>
        {anchorPoints.length === 0 ? (
          <p className="zp-eyebrow">Aguardando preenchimento em campo.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {anchorPoints.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-gray-light)" }}>
                <span>{p.tag}</span>
                <span>{p.photos.length} foto(s)</span>
                {p.result_confirmed_at ? (
                  <StatusBadge label={`Confirmado: ${PULL_TEST_RESULT_LABELS[p.test_result!]}`} tone={PULL_TEST_RESULT_TONE[p.test_result!]} />
                ) : p.test_result ? (
                  <StatusBadge label={`Sugestão: ${PULL_TEST_RESULT_LABELS[p.test_result]}`} tone="warning" />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {isStaff && report.status === "in_review" && (
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.95rem", marginBottom: 4 }}>Revisão de engenharia</h3>
          <p style={{ marginBottom: 12 }}>
            Confirme o parecer de cada ponto, preencha identificação, rastreabilidade, não conformidades, recomendações e anexos, e aprove/assine — tudo em um único fluxo guiado.
          </p>
          <Button onClick={() => setReviewOpen(true)}>Revisar laudo</Button>
        </Card>
      )}

      {reviewOpen && (
        <ReviewWizard
          report={report}
          anchorPoints={anchorPoints}
          onClose={() => setReviewOpen(false)}
          onChanged={reload}
        />
      )}

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Documentos</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button variant="outline" disabled={busy || pdfStatus.report === "generating"} onClick={() => requestPdf("report", "preview")}>
            {pdfStatus.report === "generating" ? "Gerando…" : "Gerar e pré-visualizar PDF"}
          </Button>
          <Button variant="outline" disabled={busy || pdfStatus.labels === "generating"} onClick={() => requestPdf("labels")}>
            {pdfStatus.labels === "generating" ? "Gerando…" : "Gerar etiquetas de numeração"}
          </Button>
          {report.pdf_url && (
            <Button variant="secondary" onClick={openPreview}>
              Visualizar último PDF gerado
            </Button>
          )}
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
        {previewUrl && (
          <div style={{ marginTop: 16 }}>
            <div className="zp-eyebrow" style={{ marginBottom: 8 }}>
              Pré-visualização (rascunho — a versão final é gerada ao aprovar e assinar)
            </div>
            <iframe title="Pré-visualização do laudo" src={previewUrl} style={{ width: "100%", height: 720, border: "1px solid var(--color-gray-light)", borderRadius: "var(--radius)" }} />
          </div>
        )}
      </Card>

    </div>
  );
}
