import {
  ANCHOR_ISSUE_TAGS,
  ATTACHMENT_CATEGORY_LABELS,
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  DEVICE_VERIFICATION_LABELS,
  NONCONFORMITY_SEVERITY_LABELS,
  NONCONFORMITY_STATUS_LABELS,
  VERIFICATION_SITUATION_LABELS,
  type AnchorPoint,
  type Report,
  type ReportAttachment,
  type ReportParty,
} from "@zoppi/shared";

const ISSUE_TAG_LABELS: Record<string, string> = Object.fromEntries(ANCHOR_ISSUE_TAGS.map((t) => [t.value, t.label]));

export interface ReportBrand {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  headerText: string | null;
  footerText: string | null;
}

export interface ReportPdfData {
  report: Report;
  contratante: ReportParty | null;
  contratada: ReportParty | null;
  anchorPoints: (AnchorPoint & { accessoryName: string | null; referenceLoadKgf: number | null; photoUrls: { url: string; caption: string }[] })[];
  engineer: { fullName: string; creaNumber: string | null; signatureUrl: string | null } | null;
  attachments: (ReportAttachment & { url: string })[];
  complementaryPhotos: { url: string; caption: string }[];
  verificationQrDataUrl: string;
  brand: ReportBrand;
}

const TEST_RESULT_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  atencao: "Atenção",
  reprovado: "Reprovado",
};

const INSTALLATION_LABEL: Record<string, string> = {
  quimico: "Químico",
  mecanico: "Mecânico",
};

const DEFAULT_OBJECTIVE_TEXT =
  "Registrar a inspeção, verificação documental e, quando previsto pelo responsável técnico, o ensaio dos dispositivos de ancoragem do local identificado, consolidando evidências, rastreabilidade e parecer técnico sobre sua condição para a finalidade declarada.";

const DEFAULT_SCOPE_TEXT =
  "O escopo abrange os dispositivos de ancoragem inspecionados neste laudo, restringindo-se às condições verificadas e documentadas no período da inspeção.";

const DEFAULT_RECOMMENDATIONS_TEXT = [
  "Utilizar o sistema somente por trabalhadores capacitados, dentro da finalidade, direção de esforço e limites definidos no projeto/fabricante.",
  "Realizar verificação prévia antes do uso, observando fixação, corrosão, deformação, trinca, folga, marcação e condição do entorno.",
  "Não utilizar dispositivo destinado à proteção contra quedas para içamento ou suspensão de cargas, salvo se houver projeto e finalidade expressamente compatíveis.",
  "Após retenção de queda, impacto, dano, intervenção na fixação ou dúvida quanto à integridade, retirar o ponto de serviço e submeter a avaliação formal antes da reutilização.",
  "Manter ART, projeto/memorial, certificados, fichas técnicas, calibrações, registros fotográficos e histórico de inspeções vinculados ao laudo.",
  "Executar inspeções periódicas na frequência definida pelo responsável técnico, projeto, fabricante e requisitos aplicáveis.",
];

function callout(text: string): string {
  return `<p class="callout body-text">${escapeHtml(text)}</p>`;
}

const METHODOLOGY_STEPS: { step: string; check: string; record: string }[] = [
  { step: "Documentação", check: "Projeto, ART, ficha técnica, certificados, histórico e identificação.", record: "Cópia ou referência vinculada ao laudo (seção Anexos)." },
  { step: "Inspeção visual", check: "Corrosão, trincas, deformações, desgaste, integridade e condições do entorno.", record: "Registro fotográfico e observações por ponto." },
  { step: "Geometria e fixação", check: "Dimensões, profundidade/posição, aperto, substrato, distâncias e montagem.", record: "Medidas registradas na ficha individual do ponto." },
  { step: "Rastreabilidade", check: "Modelo, lote/série, marcações e vínculo com acessórios/certificados.", record: "Dados técnicos na ficha individual do ponto." },
  { step: "Ensaio, quando aplicável", check: "Instrumento calibrado, carga definida, tempo, direção da força e observação de falhas/deformações.", record: "Dados do ensaio na ficha individual do ponto." },
  { step: "Registro", check: "Fotos, leituras, resultado por ponto, não conformidades e parecer.", record: "Seções 6 a 10 deste laudo." },
];

function methodologyStepsTable(): string {
  return `
    <table class="points-summary">
      <thead><tr><th>Etapa</th><th>Verificação</th><th>Registro esperado</th></tr></thead>
      <tbody>
        ${METHODOLOGY_STEPS.map((s) => `<tr><td>${escapeHtml(s.step)}</td><td>${escapeHtml(s.check)}</td><td>${escapeHtml(s.record)}</td></tr>`).join("")}
      </tbody>
    </table>`;
}

const ACCEPTANCE_CRITERIA: { criterion: string; expected: string }[] = [
  { criterion: "Integridade visual", expected: "Sem corrosão avançada, trincas, deformação estrutural ou desgaste que comprometa a resistência." },
  { criterion: "Fixação / substrato", expected: "Fixação firme, sem folga, sinais de arrancamento ou degradação do substrato/resina." },
  { criterion: "Dimensional / instalação", expected: "Profundidade, distâncias e montagem conforme projeto/fabricante." },
  { criterion: "Ensaio", expected: "Suporta a carga e o tempo definidos pelo responsável técnico sem falha, deformação permanente ou deslocamento." },
  { criterion: "Documentação / rastreabilidade", expected: "Identificação, modelo/lote e certificados localizáveis e coerentes com o dispositivo inspecionado." },
];

function acceptanceCriteriaTable(): string {
  return `
    <table class="points-summary">
      <thead><tr><th>Critério</th><th>Aceitação esperada</th></tr></thead>
      <tbody>
        ${ACCEPTANCE_CRITERIA.map((c) => `<tr><td>${escapeHtml(c.criterion)}</td><td>${escapeHtml(c.expected)}</td></tr>`).join("")}
      </tbody>
    </table>`;
}

function complementaryPhotosSection(photos: ReportPdfData["complementaryPhotos"]): string {
  if (photos.length === 0) return "";
  return `
    <div class="subsection-title">Relatório fotográfico complementar</div>
    <div class="photos">
      ${photos.map((photo) => `
      <figure class="photo">
        <img src="${photo.url}" alt="${escapeHtml(photo.caption)}" />
        <figcaption>${escapeHtml(photo.caption)}</figcaption>
      </figure>`).join("")}
    </div>`;
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function nl2p(value: string | null | undefined, fallback: string): string {
  const text = value && value.trim().length > 0 ? value : fallback;
  return text
    .split(/\n+/)
    .map((line) => `<p class="body-text">${escapeHtml(line)}</p>`)
    .join("");
}

function overallStatus(points: ReportPdfData["anchorPoints"]): { label: string; tone: string } {
  if (points.length === 0) return { label: "Pendente", tone: "atencao" };
  if (points.some((p) => p.test_result === "reprovado")) return { label: "Reprovado", tone: "reprovado" };
  if (points.some((p) => p.test_result !== "aprovado")) return { label: "Com restrições", tone: "atencao" };
  return { label: "Aprovado", tone: "aprovado" };
}

function partyBlock(title: string, party: ReportParty | null): string {
  if (!party) return `<div class="party"><h3>${title}</h3><p class="muted">Não informado</p></div>`;
  return `
    <div class="party">
      <h3>${title}</h3>
      <p><strong>${escapeHtml(party.legal_name)}</strong></p>
      ${party.cnpj ? `<p>CNPJ: ${escapeHtml(party.cnpj)}</p>` : ""}
      ${party.address ? `<p>${escapeHtml(party.address)}</p>` : ""}
      ${party.contact_name ? `<p>Contato: ${escapeHtml(party.contact_name)} ${party.contact_role ? `(${escapeHtml(party.contact_role)})` : ""}</p>` : ""}
      ${party.contact_phone ? `<p>Tel: ${escapeHtml(party.contact_phone)}</p>` : ""}
      ${party.contact_email ? `<p>E-mail: ${escapeHtml(party.contact_email)}</p>` : ""}
    </div>`;
}

function anchorPointBlock(point: ReportPdfData["anchorPoints"][number], index: number): string {
  const resultTone = point.test_result ?? "";
  const photos = point.photoUrls
    .map(
      (photo) => `
      <figure class="photo">
        <img src="${photo.url}" alt="${escapeHtml(photo.caption)}" />
        <figcaption>${escapeHtml(photo.caption)}</figcaption>
      </figure>`,
    )
    .join("");

  return `
    <section class="anchor-point" data-index="${index}">
      <h3>${escapeHtml(point.tag)} <span class="result result-${resultTone}">${point.test_result ? TEST_RESULT_LABEL[point.test_result] : "—"}</span></h3>
      <table class="specs">
        <tbody>
          <tr><td>Acessório</td><td>${escapeHtml(point.accessoryName ?? "—")}</td></tr>
          <tr><td>Tipo de dispositivo (NBR 16325-1)</td><td>${escapeHtml(point.device_type) || "—"}</td></tr>
          <tr><td>Tipo do sistema</td><td>${escapeHtml(point.system_type) || "—"}</td></tr>
          <tr><td>Finalidade</td><td>${escapeHtml(point.system_purpose) || "—"}</td></tr>
          <tr><td>Capacidade / usuários</td><td>${escapeHtml(point.capacity_users) || "—"}</td></tr>
          <tr><td>Estrutura suporte</td><td>${escapeHtml(point.support_structure) || "—"}</td></tr>
          <tr><td>Condição ambiental</td><td>${escapeHtml(point.environment_condition) || "—"}</td></tr>
          <tr><td>Modo de instalação</td><td>${point.installation_mode ? INSTALLATION_LABEL[point.installation_mode] : "—"}</td></tr>
          <tr><td>Modo de fixação (detalhe)</td><td>${escapeHtml(point.fixation_mode_detail) || "—"}</td></tr>
          <tr><td>Profundidade do chumbador</td><td>${point.anchor_depth_mm ?? "—"} mm</td></tr>
          <tr><td>Distância entre pontos</td><td>${point.distance_between_points_mm ?? "—"} mm</td></tr>
          <tr><td>Material / fixação</td><td>${escapeHtml(point.fixation_material_reference) || "—"}</td></tr>
          <tr><td>Carga de referência (projeto/fabricante)</td><td>${point.referenceLoadKgf ?? "—"} kgf</td></tr>
          <tr><td>Carga aplicada</td><td>${point.test_applied_load_kgf ?? "—"} kgf</td></tr>
          <tr><td>Tempo de teste</td><td>${point.test_duration_seconds ?? "—"} s</td></tr>
          <tr><td>Direção da carga</td><td>${escapeHtml(point.test_load_direction) || "—"}</td></tr>
          <tr><td>Resultado</td><td class="result result-${resultTone}">${point.test_result ? TEST_RESULT_LABEL[point.test_result] : "—"}</td></tr>
        </tbody>
      </table>
      ${
        point.issue_tags?.length
          ? `<p class="issue-tags">${point.issue_tags.map((tag) => `<span class="issue-tag">${escapeHtml(ISSUE_TAG_LABELS[tag] ?? tag)}</span>`).join("")}</p>`
          : ""
      }
      ${point.notes ? `<p class="notes">${escapeHtml(point.notes)}</p>` : ""}
      <div class="photos">${photos}</div>
    </section>`;
}

// Conclusion follows the same rule the reference laudo (IS-LD-034-00) states:
// approved only once every point cleared its test — "atenção"/"reprovado" on
// any point means the set isn't cleared for use as-is. The engineer can
// override this default narrative via report.conclusion_text during review.
function defaultConclusionText(points: ReportPdfData["anchorPoints"]): string {
  if (points.length === 0) return "Nenhum ponto de ancoragem foi registrado neste laudo.";
  const allApproved = points.every((p) => p.test_result === "aprovado");
  if (allApproved) {
    return "Com base na documentação disponível, inspeções e ensaios efetivamente realizados, os pontos de ancoragem atenderam aos critérios de aceitação estabelecidos, sendo aprovados para utilização.";
  }
  const flagged = points.filter((p) => p.test_result !== "aprovado").map((p) => p.tag);
  return `Com base na documentação disponível, inspeções e ensaios efetivamente realizados, os seguintes pontos não atenderam integralmente aos critérios de aceitação e requerem atenção antes da liberação para uso: ${flagged.join(", ")}.`;
}

function componentsTable(report: Report): string {
  const items = report.components ?? [];
  if (items.length === 0) return `<p class="muted body-text">Nenhum componente cadastrado.</p>`;
  return `
    <table class="points-summary">
      <thead><tr><th>Item</th><th>Fabricante / modelo</th><th>Material</th><th>Lote / série</th><th>Documento</th></tr></thead>
      <tbody>
        ${items
          .map(
            (c) =>
              `<tr><td>${escapeHtml(c.item)}</td><td>${escapeHtml(c.manufacturerModel) || "—"}</td><td>${escapeHtml(c.material) || "—"}</td><td>${escapeHtml(c.lotSerial) || "—"}</td><td>${escapeHtml(c.document) || "—"}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function verificationChecksTable(report: Report): string {
  const saved = report.verification_checks ?? [];
  const rows = DEVICE_VERIFICATION_LABELS.map((label) => saved.find((c) => c.label === label) ?? { label, situation: null, observation: null });
  return `
    <table class="points-summary">
      <thead><tr><th>Verificação</th><th>Situação</th><th>Observação</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr><td>${escapeHtml(r.label)}</td><td>${r.situation ? escapeHtml(VERIFICATION_SITUATION_LABELS[r.situation]) : "—"}</td><td>${escapeHtml(r.observation) || "—"}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function nonconformitiesTable(report: Report): string {
  const items = report.nonconformities ?? [];
  if (items.length === 0) return `<p class="muted body-text">Nenhuma não conformidade registrada.</p>`;
  return `
    <table class="points-summary">
      <thead><tr><th>ID</th><th>Ponto</th><th>Descrição</th><th>Severidade</th><th>Ação requerida</th><th>Status</th></tr></thead>
      <tbody>
        ${items
          .map(
            (nc) =>
              `<tr><td>${escapeHtml(nc.id)}</td><td>${escapeHtml(nc.pointTag) || "—"}</td><td>${escapeHtml(nc.description)}</td><td>${escapeHtml(NONCONFORMITY_SEVERITY_LABELS[nc.severity])}</td><td>${escapeHtml(nc.actionRequired) || "—"}</td><td>${escapeHtml(NONCONFORMITY_STATUS_LABELS[nc.status])}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function revisionsTable(report: Report): string {
  const items = report.revisions?.length ? report.revisions : [{ revision: report.revision, date: report.issued_at, responsible: null, description: "Emissão" }];
  return `
    <table class="points-summary">
      <thead><tr><th>Rev.</th><th>Data</th><th>Responsável</th><th>Descrição</th></tr></thead>
      <tbody>
        ${items
          .map(
            (r) =>
              `<tr><td>${escapeHtml(r.revision)}</td><td>${formatDate(r.date)}</td><td>${escapeHtml(r.responsible) || "—"}</td><td>${escapeHtml(r.description) || "—"}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function attachmentsTable(attachments: ReportPdfData["attachments"]): string {
  if (attachments.length === 0) {
    return `
      <table class="points-summary annex-index">
        <thead><tr><th>Anexo</th><th>Descrição</th><th>Nota</th></tr></thead>
        <tbody>
          <tr><td>I</td><td>ART — Anotação de Responsabilidade Técnica</td><td>Obrigatório quando aplicável à emissão profissional</td></tr>
          <tr><td>II</td><td>Certificado de calibração do instrumento de ensaio</td><td>Vincular número, validade e equipamento</td></tr>
          <tr><td>III</td><td>Croqui / planta de localização e identificação dos pontos</td><td>Usar tags idênticas às fichas individuais</td></tr>
          <tr><td>IV</td><td>Fichas técnicas e certificados dos dispositivos/acessórios</td><td>Incluir documentos por modelo/lote utilizado</td></tr>
          <tr><td>V</td><td>Projeto / memorial de cálculo / detalhes de fixação</td><td>Quando aplicável ao escopo e conclusão</td></tr>
          <tr><td>VI</td><td>Relatórios laboratoriais / resistência / corrosão</td><td>Quando fornecidos ou requeridos</td></tr>
          <tr><td>VII</td><td>Etiquetas de identificação dos pontos</td><td>Geradas pela plataforma quando aplicável</td></tr>
        </tbody>
      </table>
      <p class="muted body-text" style="margin-top:3mm;">Nenhum anexo foi vinculado a este laudo até o momento.</p>`;
  }
  return `
    <table class="points-summary annex-index">
      <thead><tr><th>Categoria</th><th>Documento</th><th>Incluído em</th></tr></thead>
      <tbody>
        ${attachments
          .map(
            (a) =>
              `<tr><td>${escapeHtml(ATTACHMENT_CATEGORY_LABELS[a.category] ?? a.category)}</td><td>${escapeHtml(a.label)}</td><td>${formatDate(a.created_at)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function inspectionHistoryTable(report: Report): string {
  const items = report.inspection_history ?? [];
  if (items.length === 0) return `<p class="muted body-text">Sem histórico de inspeções/revalidações anterior a este laudo.</p>`;
  return `
    <table class="points-summary">
      <thead><tr><th>Data</th><th>Ponto / sistema</th><th>Responsável</th><th>Resultado</th><th>Documento / observação</th></tr></thead>
      <tbody>
        ${items
          .map(
            (h) =>
              `<tr><td>${formatDate(h.date)}</td><td>${escapeHtml(h.pointOrSystem) || "—"}</td><td>${escapeHtml(h.responsible) || "—"}</td><td>${escapeHtml(h.result) || "—"}</td><td>${escapeHtml(h.documentNote) || "—"}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

// Renders the full report as print-ready HTML, following the section order
// of the master laudo template (Laudo_Ancoragem_Modelo_Mestre_Zoppi.docx):
// 1 identificação/responsáveis, 2-3 objetivo/escopo/referências, 4 sistema e
// rastreabilidade, 5 metodologia/equipamento, 6 resumo dos resultados,
// 7 ficha por ponto, 8 não conformidades, 9 recomendações/histórico,
// 10 conclusão/assinaturas, A índice de anexos. Puppeteer converts this to
// A4 PDF (see generateReportPdf.ts); page-break rules live in the CSS below.
export function renderReportHtml(data: ReportPdfData): string {
  const { report, brand } = data;
  const primary = brand.primaryColor || DEFAULT_BRAND_PRIMARY_COLOR;
  const secondary = brand.secondaryColor || DEFAULT_BRAND_SECONDARY_COLOR;
  const status = overallStatus(data.anchorPoints);
  const approvedCount = data.anchorPoints.filter((p) => p.test_result === "aprovado").length;
  const attentionCount = data.anchorPoints.filter((p) => p.test_result === "atencao").length;
  const rejectedCount = data.anchorPoints.filter((p) => p.test_result === "reprovado").length;
  const testedCount = data.anchorPoints.filter((p) => p.test_result).length;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  :root { --brand-primary: ${primary}; --brand-secondary: ${secondary}; }
  @page { size: A4; margin: 25mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Barlow', Arial, sans-serif;
    color: #2D2D2D;
    background: #FFFFFF;
    font-size: 11pt;
    line-height: 1.45;
  }
  h1, h2, h3 { font-family: 'Barlow Condensed', Arial, sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; color: var(--brand-primary); }
  .cover { page-break-after: always; text-align: center; padding-top: 40mm; }
  .cover h1 { font-size: 26pt; margin-bottom: 2mm; }
  .cover h2 { font-size: 13pt; color: var(--brand-secondary); margin-top: 0; }
  .cover .meta { color: #8892A4; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 9pt; }
  .cover-status { display: inline-block; margin-top: 8mm; padding: 3mm 8mm; border-radius: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: color-mix(in srgb, currentColor 10%, transparent); }
  .cover .parties { display: flex; justify-content: center; gap: 16mm; margin-top: 16mm; text-align: left; }
  table.cover-meta { width: 100%; max-width: 150mm; margin: 10mm auto 0; border-collapse: collapse; text-align: left; }
  table.cover-meta td { padding: 2mm 3mm; border-bottom: 1px solid #E8EAF0; font-size: 9.5pt; }
  table.cover-meta td:first-child { color: #8892A4; width: 45%; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.05em; }
  .section-title { border-bottom: 2px solid var(--brand-secondary); padding-bottom: 2mm; margin-top: 8mm; margin-bottom: 4mm; break-after: avoid; page-break-after: avoid; }
  .subsection-title { font-size: 10.5pt; margin-top: 6mm; margin-bottom: 2mm; color: var(--brand-primary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; break-after: avoid; page-break-after: avoid; }
  .body-text { break-inside: avoid; page-break-inside: avoid; orphans: 3; widows: 3; }
  .muted { color: #8892A4; }
  .party h3 { font-size: 11pt; }
  .anchor-point { break-inside: avoid; page-break-inside: avoid; border: 1px solid #E8EAF0; border-radius: 4px; padding: 5mm; margin-bottom: 5mm; }
  .anchor-point h3 { display: flex; justify-content: space-between; align-items: center; font-size: 12pt; }
  table.specs { width: 100%; border-collapse: collapse; }
  table.specs td { padding: 1.5mm 2mm; border-bottom: 1px solid #E8EAF0; font-size: 9.5pt; }
  table.specs td:first-child { color: #8892A4; width: 45%; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.05em; }
  .result-aprovado { color: #2E9E58; font-weight: 600; }
  .result-atencao { color: var(--brand-secondary); font-weight: 600; }
  .result-reprovado { color: #D93636; font-weight: 600; }
  .notes { font-size: 9.5pt; color: #2D2D2D; margin-top: 3mm; }
  .issue-tags { margin-top: 3mm; }
  .issue-tag { display: inline-block; padding: 2px 6px; margin: 0 3mm 2mm 0; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; color: var(--brand-secondary); background: color-mix(in srgb, var(--brand-secondary) 8%, transparent); border: 1px solid color-mix(in srgb, var(--brand-secondary) 16%, transparent); }
  .photos { display: flex; flex-wrap: wrap; gap: 3mm; margin-top: 3mm; }
  .photo { width: 45mm; margin: 0; break-inside: avoid; page-break-inside: avoid; }
  .photo img { width: 100%; height: 32mm; object-fit: cover; border-radius: 4px; border: 1px solid #E8EAF0; }
  .photo figcaption { font-size: 7.5pt; color: #8892A4; text-align: center; margin-top: 1mm; }
  .signature-page { page-break-before: always; text-align: center; padding-top: 30mm; }
  .signature-block { margin-top: 10mm; }
  .signature-block .qr { margin: 6mm auto; }
  table.signers { width: 100%; max-width: 150mm; margin: 10mm auto 0; border-collapse: collapse; text-align: left; }
  table.signers th, table.signers td { border: 1px solid #E8EAF0; padding: 2mm; font-size: 9pt; }
  table.signers th { background: var(--brand-primary); color: #fff; text-transform: uppercase; font-size: 8pt; }
  table.points-summary { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  table.points-summary thead { display: table-header-group; }
  table.points-summary th, table.points-summary td { border: 1px solid #E8EAF0; padding: 2mm; font-size: 8.5pt; text-align: left; }
  table.points-summary th { background: var(--brand-primary); color: #fff; text-transform: uppercase; font-size: 7.5pt; }
  table.points-summary tbody tr, table.signers tbody tr, table.specs tr { break-inside: avoid; page-break-inside: avoid; }
  table.specs { break-inside: avoid; page-break-inside: avoid; }
  .synthesis { display: flex; flex-wrap: wrap; gap: 4mm; margin-top: 4mm; break-inside: avoid; page-break-inside: avoid; }
  .synthesis .stat { flex: 1 1 30mm; border: 1px solid #E8EAF0; border-radius: 4px; padding: 3mm; text-align: center; }
  .synthesis .stat .n { font-size: 16pt; font-weight: 800; color: var(--brand-primary); }
  .synthesis .stat .l { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.03em; color: #8892A4; }
  .legend span { display: inline-block; margin-right: 6mm; font-size: 8.5pt; font-weight: 600; }
  ul.references, ol.numbered { margin: 0; padding-left: 5mm; font-size: 9.5pt; }
  ul.references li, ol.numbered li { margin-bottom: 1.5mm; break-inside: avoid; page-break-inside: avoid; }
  ul.references, ol.numbered { break-inside: auto; }
  .synthesis .stat { break-inside: avoid; page-break-inside: avoid; }
  .annex-index td:first-child { width: 12%; }
  .callout { background: color-mix(in srgb, var(--brand-secondary) 6%, transparent); border-left: 3px solid var(--brand-secondary); padding: 3mm 4mm; margin-top: 3mm; font-size: 9.5pt; break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
  <section class="cover">
    <img src="${brand.logoUrl}" alt="Logo" style="height:14mm;margin-bottom:10mm;" />
    <h1>Laudo Técnico</h1>
    <h2>Inspeção, Verificação e Ensaio de Sistema de Ancoragem</h2>
    <p class="meta">${escapeHtml(report.name)}</p>
    <span class="cover-status result-${status.tone}" style="border:1px solid currentColor;">${status.label}</span>
    <table class="cover-meta">
      <tbody>
        <tr><td>Nº do laudo</td><td>${escapeHtml(report.report_number) || "—"}</td></tr>
        <tr><td>Revisão</td><td>${escapeHtml(report.revision) || "00"}</td></tr>
        <tr><td>Obra / local</td><td>${escapeHtml(report.site_identification) || "—"}</td></tr>
        <tr><td>Emissão / validade</td><td>${formatDate(report.issued_at)} / ${formatDate(report.valid_until)}</td></tr>
        <tr><td>ART</td><td>${escapeHtml(report.art_number) || "—"}</td></tr>
        <tr><td>Responsável técnico</td><td>${escapeHtml(data.engineer?.fullName) || "—"}${data.engineer?.creaNumber ? ` · CREA ${escapeHtml(data.engineer.creaNumber)}` : ""}</td></tr>
      </tbody>
    </table>
    <div class="parties">
      ${partyBlock("Contratante", data.contratante)}
      ${partyBlock("Contratada", data.contratada)}
    </div>
  </section>

  <h2 class="section-title">1. Identificação e responsáveis</h2>
  <div class="subsection-title">Dados do laudo</div>
  <table class="specs">
    <tbody>
      <tr><td>Número</td><td>${escapeHtml(report.report_number) || "—"}</td></tr>
      <tr><td>Nome do laudo</td><td>${escapeHtml(report.name)}</td></tr>
      <tr><td>Revisão</td><td>${escapeHtml(report.revision) || "00"}</td></tr>
      <tr><td>Data de emissão</td><td>${formatDate(report.issued_at)}</td></tr>
      <tr><td>Validade</td><td>${formatDate(report.valid_until)}</td></tr>
      <tr><td>ART</td><td>${escapeHtml(report.art_number) || "—"}</td></tr>
    </tbody>
  </table>

  <div class="subsection-title">Obra / local de inspeção</div>
  <table class="specs">
    <tbody>
      <tr><td>Obra / unidade</td><td>${escapeHtml(report.site_identification) || "—"}</td></tr>
      <tr><td>Endereço</td><td>${escapeHtml(report.site_address) || "—"}</td></tr>
      <tr><td>Área / pavimento</td><td>${escapeHtml(report.site_area) || "—"}</td></tr>
      <tr><td>Data do levantamento</td><td>${formatDate(report.survey_date)}</td></tr>
      <tr><td>O.S. / contrato</td><td>${escapeHtml(report.os_contract_number) || "—"}</td></tr>
    </tbody>
  </table>

  <div class="subsection-title">Profissionais envolvidos</div>
  <table class="points-summary">
    <thead><tr><th>Função</th><th>Nome</th><th>Qualificação / registro</th></tr></thead>
    <tbody>
      <tr><td>Responsável técnico</td><td>${escapeHtml(data.engineer?.fullName) || "—"}</td><td>${data.engineer?.creaNumber ? `CREA ${escapeHtml(data.engineer.creaNumber)}` : "—"}</td></tr>
      <tr><td>Executante em campo</td><td>${escapeHtml(report.field_executor_name) || "—"}</td><td>${escapeHtml(report.field_executor_role) || "—"}</td></tr>
      <tr><td>Acompanhante / cliente</td><td>${escapeHtml(report.accompanying_client_name) || "—"}</td><td>${escapeHtml(report.accompanying_client_role) || "—"}</td></tr>
    </tbody>
  </table>

  <h2 class="section-title">2. Objetivo e escopo</h2>
  <div class="subsection-title">Objetivo</div>
  ${nl2p(report.objective_text, DEFAULT_OBJECTIVE_TEXT)}
  <div class="subsection-title">Escopo</div>
  ${nl2p(report.scope_text, DEFAULT_SCOPE_TEXT)}
  ${callout(
    "A carga nominal/de projeto e a carga de ensaio não são tratadas como sinônimos: o valor de ensaio, o tempo de aplicação e o critério de aceitação foram definidos pelo responsável técnico conforme projeto, tipo de dispositivo, substrato, fabricante e referências normativas aplicáveis.",
  )}

  <h2 class="section-title">3. Referências e critérios técnicos</h2>
  <ul class="references body-text">
    <li>NR 35 — Trabalho em Altura (Portaria 3.214/78 do MTE).</li>
    <li>NR 18 — Segurança e Saúde no Trabalho na Indústria da Construção, quando aplicável ao contexto da edificação/obra.</li>
    <li>ABNT NBR 16325-1 — Dispositivos de ancoragem: requisitos e métodos aplicáveis ao tipo de dispositivo.</li>
    <li>ABNT NBR 16325-2, quando o sistema inspecionado envolver linha de vida horizontal compatível com seu escopo.</li>
    <li>Projeto estrutural / memorial de cálculo / especificação do sistema de ancoragem, quando aplicável.</li>
    <li>Manual, ficha técnica e critérios do fabricante dos dispositivos e elementos de fixação.</li>
  </ul>
  <p class="body-text" style="margin-top:4mm;">
    O laudo não substitui projeto de ancoragem, cálculo estrutural ou manual do fabricante quando estes forem exigidos/aplicáveis.
    Alteração, remanejamento, impacto, queda retida, dano, intervenção na fixação ou mudança relevante do substrato exige reavaliação antes da reutilização.
  </p>

  <h2 class="section-title">4. Componentes, rastreabilidade e verificação</h2>
  <p class="body-text muted">A descrição do sistema (tipo, finalidade, capacidade, estrutura suporte, fixação e condição ambiental) é registrada por ponto — ver ficha individual na seção 7.</p>
  <div class="subsection-title">Componentes, materiais e rastreabilidade</div>
  ${componentsTable(report)}
  <div class="subsection-title">Verificação de identificação do dispositivo</div>
  ${verificationChecksTable(report)}

  <h2 class="section-title">5. Metodologia de inspeção e ensaio</h2>
  <div class="subsection-title">Sequência mínima de verificação</div>
  ${methodologyStepsTable()}
  <div class="subsection-title">Equipamento de ensaio</div>
  <table class="specs">
    <tbody>
      <tr><td>Instrumento</td><td>${escapeHtml(report.test_equipment_manufacturer)} ${escapeHtml(report.test_equipment_model)}</td></tr>
      <tr><td>Nº de série</td><td>${escapeHtml(report.test_equipment_serial) || "—"}</td></tr>
      <tr><td>Capacidade do instrumento</td><td>${report.test_equipment_capacity_kgf ?? "—"} kgf</td></tr>
    </tbody>
  </table>
  <div class="subsection-title">Critérios de aceitação por ponto</div>
  ${acceptanceCriteriaTable()}
  ${callout(
    "Registrar a direção de aplicação da carga e o comportamento do conjunto. Se houver condição insegura, dúvida técnica, dano ou interrupção de queda, o dispositivo deve permanecer sem liberação até avaliação/correção formal.",
  )}

  <h2 class="section-title">6. Resumo dos resultados</h2>
  <table class="points-summary">
    <thead><tr><th>Tag</th><th>Modo</th><th>Carga</th><th>Tempo</th><th>Resultado</th></tr></thead>
    <tbody>
      ${data.anchorPoints
        .map(
          (p) =>
            `<tr><td>${escapeHtml(p.tag)}</td><td>${p.installation_mode ? INSTALLATION_LABEL[p.installation_mode] : "—"}</td><td>${p.test_applied_load_kgf ?? "—"} kgf</td><td>${p.test_duration_seconds ?? "—"} s</td><td class="result result-${p.test_result ?? ""}">${p.test_result ? TEST_RESULT_LABEL[p.test_result] : "—"}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <div class="legend" style="margin-top:4mm;">
    <span class="result-aprovado">■ Aprovado</span>
    <span class="result-atencao">■ Atenção</span>
    <span class="result-reprovado">■ Reprovado</span>
  </div>
  <div class="synthesis">
    <div class="stat"><div class="n">${data.anchorPoints.length}</div><div class="l">Pontos cadastrados</div></div>
    <div class="stat"><div class="n">${testedCount}</div><div class="l">Pontos ensaiados</div></div>
    <div class="stat"><div class="n">${approvedCount}</div><div class="l">Aprovados</div></div>
    <div class="stat"><div class="n">${attentionCount}</div><div class="l">Com atenção</div></div>
    <div class="stat"><div class="n">${rejectedCount}</div><div class="l">Reprovados</div></div>
  </div>

  <h2 class="section-title">7. Ficha individual por ponto de ancoragem</h2>
  ${data.anchorPoints.map((p, i) => anchorPointBlock(p, i)).join("")}

  <h2 class="section-title">8. Evidências complementares e não conformidades</h2>
  ${complementaryPhotosSection(data.complementaryPhotos)}
  <div class="subsection-title">Não conformidades / pendências</div>
  ${nonconformitiesTable(report)}
  ${callout(
    'Quando uma condição comprometer a segurança ou houver dúvida sobre a integridade do conjunto, o ponto correspondente é indicado como "NÃO LIBERADO PARA USO" e a condição necessária para nova liberação é registrada acima.',
  )}

  <h2 class="section-title">9. Recomendações, uso e inspeções periódicas</h2>
  <ol class="numbered body-text">
    ${(report.recommendations_text
      ? report.recommendations_text.split(/\n+/).filter(Boolean)
      : DEFAULT_RECOMMENDATIONS_TEXT
    )
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("")}
  </ol>
  <div class="subsection-title">Histórico de inspeções / revalidações</div>
  ${inspectionHistoryTable(report)}

  <h2 class="section-title">10. Conclusão técnica</h2>
  <p class="body-text"><strong>Status geral: ${status.label}</strong></p>
  ${nl2p(report.conclusion_text, defaultConclusionText(data.anchorPoints))}
  <p class="body-text">
    Condição de validade: este parecer é válido exclusivamente para a configuração e condições documentadas. Qualquer
    alteração, remanejamento, reparo, evento de queda/impacto, modificação do substrato ou condição que possa afetar a
    integridade requer reavaliação técnica antes da utilização.
  </p>

  <div class="subsection-title">Controle de revisões</div>
  ${revisionsTable(report)}

  <section class="signature-page">
    <h2>10.1 Assinaturas e verificação de autenticidade</h2>
    <div class="signature-block">
      ${
        data.engineer?.signatureUrl
          ? `<img src="${data.engineer.signatureUrl}" alt="Assinatura do responsável técnico" style="height:22mm;display:block;margin:0 auto 2mm;" />`
          : ""
      }
      <p style="border-top: ${data.engineer?.signatureUrl ? "1px solid #E8EAF0" : "none"}; padding-top: 2mm; display:inline-block;"><strong>${escapeHtml(data.engineer?.fullName ?? "—")}</strong></p>
      <p>Responsável técnico · CREA: ${escapeHtml(data.engineer?.creaNumber ?? "—")}</p>
      <p class="meta">ART: ${escapeHtml(report.art_number) || "—"} · Documento assinado digitalmente (ICP-Brasil)</p>
      <img class="qr" src="${data.verificationQrDataUrl}" alt="QR de verificação" style="height:30mm;" />
      <p class="meta">Escaneie para verificar a autenticidade deste laudo</p>
    </div>
    <table class="signers">
      <thead><tr><th>Papel</th><th>Nome</th><th>Função / registro</th></tr></thead>
      <tbody>
        <tr><td>Executante</td><td>${escapeHtml(report.field_executor_name) || "—"}</td><td>${escapeHtml(report.field_executor_role) || "—"}</td></tr>
        <tr><td>Acompanhante</td><td>${escapeHtml(report.accompanying_client_name) || "—"}</td><td>${escapeHtml(report.accompanying_client_role) || "—"}</td></tr>
      </tbody>
    </table>
  </section>

  <h2 class="section-title" style="page-break-before: always;">A. Índice de anexos</h2>
  ${attachmentsTable(data.attachments)}
  ${callout(
    "A versão final deste PDF incorpora apenas os anexos efetivamente vinculados ao laudo, mantendo ordem, identificação e rastreabilidade. O QR de verificação (seção 10.1) aponta para uma página pública que confirma autenticidade, número do laudo e status.",
  )}
</body>
</html>`;
}

export function renderHeaderTemplate(brand: ReportBrand, reportName: string): string {
  const text = brand.headerText ? brand.headerText.replace("{report}", reportName) : `${reportName}`;
  return `
    <div style="font-size:8px; width:100%; padding:0 20mm; color:#8892A4; font-family: Arial, sans-serif; display:flex; justify-content:space-between;">
      <span>${escapeHtml(text)}</span>
    </div>`;
}

export function renderFooterTemplate(brand: ReportBrand, engineerName: string, creaNumber: string | null, reportNumber: string | null): string {
  const defaultText = `Resp. técnico: ${engineerName} · CREA ${creaNumber ?? "—"} · Laudo ${reportNumber ?? "—"}`;
  const text = brand.footerText
    ? brand.footerText
        .replace("{engineer}", engineerName)
        .replace("{crea}", creaNumber ?? "—")
        .replace("{reportNumber}", reportNumber ?? "—")
    : defaultText;
  return `
    <div style="font-size:8px; width:100%; padding:0 20mm; color:#8892A4; font-family: Arial, sans-serif; display:flex; justify-content:space-between;">
      <span>${escapeHtml(text)}</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`;
}
