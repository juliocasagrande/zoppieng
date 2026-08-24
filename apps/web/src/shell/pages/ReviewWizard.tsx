import { useEffect, useState } from "react";
import type {
  AnchorPoint,
  AttachmentCategory,
  InspectionHistoryEntry,
  NonConformity,
  Report,
  ReportAttachment,
  ReportComponent,
  RevisionEntry,
  VerificationCheckItem,
} from "@zoppi/shared";
import {
  ATTACHMENT_CATEGORY_LABELS,
  DEVICE_VERIFICATION_LABELS,
  NONCONFORMITY_SEVERITY_LABELS,
  NONCONFORMITY_STATUS_LABELS,
  PULL_TEST_RESULT_LABELS,
  PULL_TEST_RESULT_TONE,
  VERIFICATION_SITUATION_LABELS,
} from "@zoppi/shared";
import { api } from "../../lib/api.js";
import { FormField, inputStyle } from "../../shared/components/FormField.js";
import { Button } from "../../shared/components/Button.js";
import { Alert } from "../../shared/components/Alert.js";
import { Modal } from "../../shared/components/Modal.js";
import { StatusBadge } from "../../shared/components/StatusBadge.js";
import { Section, StepPills } from "../../shared/components/WizardParts.js";

type StepId = "points" | "identification" | "system" | "nonconformities" | "recommendations" | "attachments" | "finish";

const STEPS: { id: StepId; title: string; color: string }[] = [
  { id: "points", title: "Pontos", color: "var(--color-navy)" },
  { id: "identification", title: "Identificação", color: "var(--color-orange)" },
  { id: "system", title: "Sistema", color: "var(--color-navy-light)" },
  { id: "nonconformities", title: "Não conformidades", color: "var(--color-danger)" },
  { id: "recommendations", title: "Recomendações", color: "var(--color-success)" },
  { id: "attachments", title: "Anexos", color: "var(--color-navy-dark)" },
  { id: "finish", title: "Concluir", color: "var(--color-orange)" },
];

type AnchorPointWithPhotos = AnchorPoint & { photos: { id: string; storage_path: string }[] };

interface ReviewWizardProps {
  report: Report;
  anchorPoints: AnchorPointWithPhotos[];
  onClose: () => void;
  onChanged: () => void;
}

// Walks the assigned engineer through every section of the master laudo
// template they're responsible for (everything the field technician doesn't
// fill in) before approving/signing — mirrors the report-creation wizard's
// look (colored steps, progress bar) so the two flows feel like one product.
export function ReviewWizard({ report, anchorPoints: initialPoints, onClose, onChanged }: ReviewWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  // Every review step is reachable from the start (unlike the creation
  // wizard, this data mostly already exists — nothing here gates progress).
  const maxReached = STEPS.length - 1;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [anchorPoints, setAnchorPoints] = useState(initialPoints);
  const [artNumber, setArtNumber] = useState(report.art_number ?? "");
  const [osContractNumber, setOsContractNumber] = useState(report.os_contract_number ?? "");
  const [revision, setRevision] = useState(report.revision ?? "00");
  const [objectiveText, setObjectiveText] = useState(report.objective_text ?? "");
  const [scopeText, setScopeText] = useState(report.scope_text ?? "");
  const [recommendationsText, setRecommendationsText] = useState(report.recommendations_text ?? "");
  const [conclusionText, setConclusionText] = useState(report.conclusion_text ?? "");
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheckItem[]>(() =>
    DEVICE_VERIFICATION_LABELS.map((label) => report.verification_checks?.find((c) => c.label === label) ?? { label, situation: null, observation: null }),
  );
  const [components, setComponents] = useState<ReportComponent[]>(report.components ?? []);
  const [nonconformities, setNonconformities] = useState<NonConformity[]>(report.nonconformities ?? []);
  const [revisions, setRevisions] = useState<RevisionEntry[]>(report.revisions ?? []);
  const [inspectionHistory, setInspectionHistory] = useState<InspectionHistoryEntry[]>(report.inspection_history ?? []);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const step = STEPS[stepIndex];

  function goTo(index: number) {
    setMessage(null);
    setStepIndex(index);
  }
  function goNext() {
    setMessage(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setMessage(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function confirmPointResult(pointId: string, testResult: "aprovado" | "atencao" | "reprovado") {
    setBusy(true);
    try {
      const updated = await api.patch(`/review/${report.id}/points/${pointId}`, { testResult });
      setAnchorPoints((pts) => pts.map((p) => (p.id === pointId ? { ...p, ...updated } : p)));
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails(): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      await api.patch(`/review/${report.id}/details`, {
        artNumber: artNumber || null,
        osContractNumber: osContractNumber || null,
        revision,
        objectiveText: objectiveText || null,
        scopeText: scopeText || null,
        recommendationsText: recommendationsText || null,
        conclusionText: conclusionText || null,
        verificationChecks,
        components,
        nonconformities,
        revisions,
        inspectionHistory,
      });
      onChanged();
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar detalhes.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openPreview() {
    setPdfGenerating(true);
    setMessage(null);
    try {
      const saved = await saveDetails();
      if (!saved) return;
      await api.post(`/reports/${report.id}/pdf`, { kind: "report" });
      await pollUntilDone();
      const { url } = await api.get(`/reports/${report.id}/pdf-url?kind=report`);
      const res = await fetch(url);
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao gerar pré-visualização.");
    } finally {
      setPdfGenerating(false);
    }
  }

  async function pollUntilDone(attempt = 0): Promise<void> {
    const status = await api.get(`/reports/${report.id}/pdf-status?kind=report`);
    if (status?.status === "done") return;
    if (status?.status === "failed") throw new Error("Falha ao gerar o PDF.");
    if (attempt >= 40) throw new Error("Geração do PDF demorou mais que o esperado.");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return pollUntilDone(attempt + 1);
  }

  async function finalize(action: "approve" | "request-changes" | "reject") {
    setBusy(true);
    setMessage(null);
    try {
      if (action === "approve") {
        const saved = await saveDetails();
        if (!saved) return;
      }
      await api.post(`/review/${report.id}/${action}`);
      onChanged();
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao processar a revisão.");
    } finally {
      setBusy(false);
    }
  }

  const pendingPoints = anchorPoints.filter((p) => !p.result_confirmed_at);
  const canApprove = anchorPoints.length > 0 && pendingPoints.length === 0;

  return (
    <Modal
      title="Revisão de engenharia"
      subtitle={`${step.title} · ${report.name}`}
      accentColor={step.color}
      onClose={onClose}
      progress={{ current: stepIndex + 1, total: STEPS.length }}
      width={840}
      footer={
        <div>
          {message && (
            <div style={{ marginBottom: 12 }}>
              <Alert tone="danger">{message}</Alert>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0} style={{ flex: "1 1 120px" }}>
              ← Voltar
            </Button>
            {step.id !== "finish" ? (
              <Button type="button" onClick={goNext} style={{ flex: "2 1 200px", background: step.color, borderColor: step.color }}>
                Próximo →
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={busy} onClick={saveDetails} style={{ flex: "1 1 160px" }}>
                Salvar rascunho
              </Button>
            )}
          </div>
        </div>
      }
    >
      <StepPills<StepId> steps={STEPS} current={stepIndex} maxReached={maxReached} onSelect={goTo} />

      <div style={{ marginTop: 20 }}>
        {step.id === "points" && (
          <Section
            color={step.color}
            title={`Pontos de ancoragem (${anchorPoints.length})`}
            description="O resultado marcado pelo técnico em campo é apenas uma sugestão — confirme (ou altere) o parecer de cada ponto."
          >
            {anchorPoints.length === 0 ? (
              <p className="zp-eyebrow">Nenhum ponto registrado ainda.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {anchorPoints.map((p) => (
                  <div key={p.id} style={{ border: "1px solid var(--color-gray-light)", borderRadius: "var(--radius)", padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <strong>{p.tag}</strong>
                        <div className="zp-eyebrow">
                          {p.photos.length} foto(s)
                          {p.device_type ? ` · ${p.device_type}` : ""}
                          {p.test_applied_load_kgf ? ` · ${p.test_applied_load_kgf} kgf` : ""}
                          {p.test_duration_seconds ? ` · ${p.test_duration_seconds}s` : ""}
                        </div>
                        {p.notes && <p style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>{p.notes}</p>}
                      </div>
                      {p.result_confirmed_at ? (
                        <StatusBadge label={`Confirmado: ${PULL_TEST_RESULT_LABELS[p.test_result!]}`} tone={PULL_TEST_RESULT_TONE[p.test_result!]} />
                      ) : p.test_result ? (
                        <StatusBadge label={`Sugestão: ${PULL_TEST_RESULT_LABELS[p.test_result]}`} tone="warning" />
                      ) : (
                        <StatusBadge label="Sem parecer" tone="warning" />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <Button variant={p.test_result === "aprovado" && p.result_confirmed_at ? "primary" : "outline"} disabled={busy} onClick={() => confirmPointResult(p.id, "aprovado")}>
                        Aprovado
                      </Button>
                      <Button variant={p.test_result === "atencao" && p.result_confirmed_at ? "primary" : "outline"} disabled={busy} onClick={() => confirmPointResult(p.id, "atencao")}>
                        Atenção
                      </Button>
                      <Button variant={p.test_result === "reprovado" && p.result_confirmed_at ? "destructive" : "outline"} disabled={busy} onClick={() => confirmPointResult(p.id, "reprovado")}>
                        Reprovado
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {step.id === "identification" && (
          <Section color={step.color} title="Identificação do laudo" description="ART e O.S./contrato são de responsabilidade do engenheiro; objetivo e escopo podem ser ajustados ao caso.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <FormField label="Nº da ART">
                <input style={inputStyle} value={artNumber} onChange={(e) => setArtNumber(e.target.value)} />
              </FormField>
              <FormField label="O.S. / contrato">
                <input style={inputStyle} value={osContractNumber} onChange={(e) => setOsContractNumber(e.target.value)} />
              </FormField>
              <FormField label="Revisão">
                <input style={inputStyle} value={revision} onChange={(e) => setRevision(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Objetivo">
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={objectiveText} onChange={(e) => setObjectiveText(e.target.value)} />
            </FormField>
            <FormField label="Escopo">
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={scopeText} onChange={(e) => setScopeText(e.target.value)} />
            </FormField>
          </Section>
        )}

        {step.id === "system" && (
          <Section color={step.color} title="Sistema, componentes e rastreabilidade" description="Checklist e tabela de rastreabilidade do laudo (seção 4 do modelo mestre).">
            <div className="zp-eyebrow" style={{ marginBottom: 8 }}>
              Verificação de identificação do dispositivo
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {verificationChecks.map((check, i) => (
                <div key={check.label} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 1.5fr", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem" }}>{check.label}</span>
                  <select
                    style={inputStyle}
                    value={check.situation ?? ""}
                    onChange={(e) =>
                      setVerificationChecks(verificationChecks.map((c, j) => (i === j ? { ...c, situation: (e.target.value || null) as VerificationCheckItem["situation"] } : c)))
                    }
                  >
                    <option value="">—</option>
                    {Object.entries(VERIFICATION_SITUATION_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input
                    style={inputStyle}
                    placeholder="Observação"
                    value={check.observation ?? ""}
                    onChange={(e) => setVerificationChecks(verificationChecks.map((c, j) => (i === j ? { ...c, observation: e.target.value } : c)))}
                  />
                </div>
              ))}
            </div>

            <RowListEditor
              title="Componentes / materiais / rastreabilidade"
              rows={components}
              onChange={setComponents}
              empty={() => ({ item: "", manufacturerModel: "", material: "", lotSerial: "", document: "" })}
              fields={[
                { key: "item", placeholder: "Item" },
                { key: "manufacturerModel", placeholder: "Fabricante / modelo" },
                { key: "material", placeholder: "Material" },
                { key: "lotSerial", placeholder: "Lote / série" },
                { key: "document", placeholder: "Documento" },
              ]}
            />
          </Section>
        )}

        {step.id === "nonconformities" && (
          <Section color={step.color} title="Não conformidades e pendências" description="Registre qualquer condição que comprometa a liberação de um ponto.">
            <RowListEditor
              title="Não conformidades"
              rows={nonconformities}
              onChange={setNonconformities}
              empty={() => ({ id: `NC-${nonconformities.length + 1}`, pointTag: "", description: "", severity: "atencao" as const, actionRequired: "", status: "aberta" as const })}
              fields={[
                { key: "id", placeholder: "ID" },
                { key: "pointTag", placeholder: "Ponto" },
                { key: "description", placeholder: "Descrição" },
                { key: "severity", placeholder: "Severidade", options: NONCONFORMITY_SEVERITY_LABELS },
                { key: "actionRequired", placeholder: "Ação requerida" },
                { key: "status", placeholder: "Status", options: NONCONFORMITY_STATUS_LABELS },
              ]}
            />
          </Section>
        )}

        {step.id === "recommendations" && (
          <Section color={step.color} title="Recomendações e histórico" description="Recomendações de uso e o histórico de inspeções/revalidações anteriores a este laudo.">
            <FormField label="Recomendações (uma por linha — deixe em branco para usar o texto padrão)">
              <textarea style={{ ...inputStyle, minHeight: 100 }} value={recommendationsText} onChange={(e) => setRecommendationsText(e.target.value)} />
            </FormField>
            <RowListEditor
              title="Histórico de inspeções / revalidações"
              rows={inspectionHistory}
              onChange={setInspectionHistory}
              empty={() => ({ date: "", pointOrSystem: "", responsible: "", result: "", documentNote: "" })}
              fields={[
                { key: "date", placeholder: "Data (aaaa-mm-dd)" },
                { key: "pointOrSystem", placeholder: "Ponto / sistema" },
                { key: "responsible", placeholder: "Responsável" },
                { key: "result", placeholder: "Resultado" },
                { key: "documentNote", placeholder: "Documento / observação" },
              ]}
            />
            <RowListEditor
              title="Controle de revisões"
              rows={revisions}
              onChange={setRevisions}
              empty={() => ({ revision: "", date: "", responsible: "", description: "" })}
              fields={[
                { key: "revision", placeholder: "Rev." },
                { key: "date", placeholder: "Data (aaaa-mm-dd)" },
                { key: "responsible", placeholder: "Responsável" },
                { key: "description", placeholder: "Descrição" },
              ]}
            />
          </Section>
        )}

        {step.id === "attachments" && <AttachmentsStep reportId={report.id} color={step.color} />}

        {step.id === "finish" && (
          <Section color={step.color} title="Conclusão e assinatura" description="Escreva o parecer final, pré-visualize o PDF e aprove/assine — ou solicite correção/rejeite.">
            <FormField label="Conclusão técnica (deixe em branco para usar o texto padrão calculado a partir dos resultados)">
              <textarea style={{ ...inputStyle, minHeight: 100 }} value={conclusionText} onChange={(e) => setConclusionText(e.target.value)} />
            </FormField>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <Button type="button" variant="outline" disabled={pdfGenerating} onClick={openPreview}>
                {pdfGenerating ? "Gerando…" : "Pré-visualizar PDF"}
              </Button>
            </div>
            {previewUrl && (
              <div style={{ marginTop: 16 }}>
                <iframe title="Pré-visualização do laudo" src={previewUrl} style={{ width: "100%", height: 480, border: "1px solid var(--color-gray-light)", borderRadius: "var(--radius)" }} />
              </div>
            )}

            {!canApprove && (
              <p className="zp-eyebrow" style={{ margin: "16px 0 0" }}>
                {anchorPoints.length === 0
                  ? "Sem pontos de ancoragem para revisar ainda."
                  : `Confirme o parecer de ${pendingPoints.length} ponto(s) na etapa "Pontos" para liberar a assinatura.`}
              </p>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <Button disabled={busy || !canApprove} onClick={() => finalize("approve")}>
                Aprovar e assinar
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => finalize("request-changes")}>
                Solicitar correção
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => finalize("reject")}>
                Rejeitar
              </Button>
            </div>
          </Section>
        )}
      </div>
    </Modal>
  );
}

// Lets the engineer attach supporting documents (calibration certificates,
// datasheets, project memorials, lab reports…) referenced in the master
// template's annex index (section A) — listed in the PDF's annex table once
// uploaded.
function AttachmentsStep({ reportId, color }: { reportId: string; color: string }) {
  const [attachments, setAttachments] = useState<(ReportAttachment & { url: string | null })[]>([]);
  const [category, setCategory] = useState<AttachmentCategory>("art");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.get(`/reports/${reportId}/attachments`).then(setAttachments).catch(() => {});
  }

  useEffect(reload, [reportId]);

  async function handleFile(file: File) {
    if (!label.trim()) {
      setError("Informe uma descrição para o anexo antes de enviar o arquivo.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const { path, signedUrl } = await api.post(`/reports/${reportId}/attachments/upload-url`, { ext });
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      await api.post(`/reports/${reportId}/attachments/confirm`, { path, category, label: label.trim() });
      setLabel("");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar anexo.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(attachmentId: string) {
    await api.delete(`/reports/${reportId}/attachments/${attachmentId}`);
    reload();
  }

  return (
    <Section color={color} title="Anexos do laudo" description="Certificado de calibração, fichas técnicas, projeto/memorial, relatórios laboratoriais e demais documentos do índice de anexos.">
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {attachments.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--color-gray-light)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{a.label}</div>
                <div className="zp-eyebrow">{ATTACHMENT_CATEGORY_LABELS[a.category]}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline">
                      Ver
                    </Button>
                  </a>
                )}
                <Button type="button" variant="outline" onClick={() => remove(a.id)}>
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <FormField label="Categoria">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value as AttachmentCategory)}>
            {Object.entries(ATTACHMENT_CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Descrição do arquivo">
          <input style={inputStyle} placeholder="Ex.: Certificado nº 1234" value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormField>
        <label>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => document.getElementById("review-attachment-upload-input")?.click()}>
            {uploading ? "Enviando…" : "Enviar arquivo"}
          </Button>
          <input
            id="review-attachment-upload-input"
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </Section>
  );
}

function RowListEditor<T extends object>({
  title,
  rows,
  onChange,
  empty,
  fields,
}: {
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: () => T;
  fields: { key: keyof T; placeholder: string; options?: Record<string, string> }[];
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="zp-eyebrow" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {fields.map((f) =>
              f.options ? (
                <select
                  key={String(f.key)}
                  style={{ ...inputStyle, flex: "1 1 120px" }}
                  value={(row[f.key] as string) ?? ""}
                  onChange={(e) => onChange(rows.map((r, j) => (i === j ? { ...r, [f.key]: e.target.value as T[typeof f.key] } : r)))}
                >
                  {Object.entries(f.options).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  key={String(f.key)}
                  style={{ ...inputStyle, flex: "1 1 120px" }}
                  placeholder={f.placeholder}
                  value={(row[f.key] as string) ?? ""}
                  onChange={(e) => onChange(rows.map((r, j) => (i === j ? { ...r, [f.key]: e.target.value as T[typeof f.key] } : r)))}
                />
              ),
            )}
            <Button type="button" variant="outline" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              Remover
            </Button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <Button type="button" variant="outline" onClick={() => onChange([...rows, empty()])}>
          + Adicionar
        </Button>
      </div>
    </div>
  );
}
