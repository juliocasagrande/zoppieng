import { ANCHOR_ISSUE_TAGS, type AnchorPoint, type Report, type ReportParty } from "@zoppi/shared";

const ISSUE_TAG_LABELS: Record<string, string> = Object.fromEntries(ANCHOR_ISSUE_TAGS.map((t) => [t.value, t.label]));

export interface ReportPdfData {
  report: Report;
  contratante: ReportParty | null;
  contratada: ReportParty | null;
  anchorPoints: (AnchorPoint & { accessoryName: string | null; photoUrls: string[] })[];
  engineer: { fullName: string; creaNumber: string | null } | null;
  verificationQrDataUrl: string;
  logoDataUrl: string;
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

function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
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
      (url, i) => `
      <figure class="photo">
        <img src="${url}" alt="Ponto ${escapeHtml(point.tag)} foto ${i + 1}" />
        <figcaption>${escapeHtml(point.tag)} — foto ${i + 1} de ${point.photoUrls.length}</figcaption>
      </figure>`,
    )
    .join("");

  return `
    <section class="anchor-point" data-index="${index}">
      <h3>${escapeHtml(point.tag)}</h3>
      <table class="specs">
        <tbody>
          <tr><td>Acessório</td><td>${escapeHtml(point.accessoryName ?? "—")}</td></tr>
          <tr><td>Modo de instalação</td><td>${point.installation_mode ? INSTALLATION_LABEL[point.installation_mode] : "—"}</td></tr>
          <tr><td>Profundidade do chumbador</td><td>${point.anchor_depth_mm ?? "—"} mm</td></tr>
          <tr><td>Distância entre pontos</td><td>${point.distance_between_points_mm ?? "—"} mm</td></tr>
          <tr><td>Instrumento de teste</td><td>${escapeHtml(point.test_instrument)}</td></tr>
          <tr><td>Carga aplicada</td><td>${point.test_applied_load_kn ?? "—"} kN</td></tr>
          <tr><td>Tempo de teste</td><td>${point.test_duration_seconds ?? "—"} s</td></tr>
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

// Renders the full report as print-ready HTML. Puppeteer converts this to
// A4 PDF (see generateReportPdf.ts). Page-break rules live in the CSS below
// per spec section 4.9: anchor points avoid splitting, headers repeat via
// Puppeteer's header/footer templates, tables repeat their <thead>.
export function renderReportHtml(data: ReportPdfData): string {
  const { report } = data;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 25mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Barlow', Arial, sans-serif;
    color: #2D2D2D;
    background: #FFFFFF;
    font-size: 11pt;
    line-height: 1.45;
  }
  h1, h2, h3 { font-family: 'Barlow Condensed', Arial, sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; color: #151F5C; }
  .cover { page-break-after: always; text-align: center; padding-top: 60mm; }
  .cover h1 { font-size: 28pt; margin-bottom: 4mm; }
  .cover .meta { color: #8892A4; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 9pt; }
  .cover .parties { display: flex; justify-content: center; gap: 16mm; margin-top: 20mm; text-align: left; }
  .section-title { border-bottom: 2px solid #E86020; padding-bottom: 2mm; margin-top: 8mm; margin-bottom: 4mm; break-after: avoid; page-break-after: avoid; }
  .party h3 { font-size: 11pt; }
  .anchor-point { break-inside: avoid; page-break-inside: avoid; border: 1px solid #E8EAF0; border-radius: 4px; padding: 5mm; margin-bottom: 5mm; }
  table.specs { width: 100%; border-collapse: collapse; }
  table.specs td { padding: 1.5mm 2mm; border-bottom: 1px solid #E8EAF0; font-size: 9.5pt; }
  table.specs td:first-child { color: #8892A4; width: 45%; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.05em; }
  .result-aprovado { color: #2E9E58; font-weight: 600; }
  .result-atencao { color: #E86020; font-weight: 600; }
  .result-reprovado { color: #D93636; font-weight: 600; }
  .notes { font-size: 9.5pt; color: #2D2D2D; margin-top: 3mm; }
  .issue-tags { margin-top: 3mm; }
  .issue-tag { display: inline-block; padding: 2px 6px; margin: 0 3mm 2mm 0; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.03em; color: #E86020; background: rgba(232,96,32,0.08); border: 1px solid rgba(232,96,32,0.16); }
  .photos { display: flex; flex-wrap: wrap; gap: 3mm; margin-top: 3mm; }
  .photo { width: 45mm; margin: 0; }
  .photo img { width: 100%; height: 32mm; object-fit: cover; border-radius: 4px; border: 1px solid #E8EAF0; }
  .photo figcaption { font-size: 7.5pt; color: #8892A4; text-align: center; margin-top: 1mm; }
  .signature-page { page-break-before: always; text-align: center; padding-top: 40mm; }
  .signature-block { margin-top: 20mm; }
  .signature-block .qr { margin: 6mm auto; }
  table.points-summary { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  table.points-summary thead { display: table-header-group; }
  table.points-summary th, table.points-summary td { border: 1px solid #E8EAF0; padding: 2mm; font-size: 9pt; text-align: left; }
  table.points-summary th { background: #151F5C; color: #fff; text-transform: uppercase; font-size: 8pt; }
</style>
</head>
<body>
  <section class="cover">
    <img src="${data.logoDataUrl}" alt="Zoppi" style="height:14mm;margin-bottom:10mm;" />
    <h1>${escapeHtml(report.name)}</h1>
    <p class="meta">Laudo Nº ${escapeHtml(report.report_number ?? "—")}</p>
    <p class="meta">Emissão: ${formatDate(report.issued_at)} · Validade: ${formatDate(report.valid_until)}</p>
    <div class="parties">
      ${partyBlock("Contratante", data.contratante)}
      ${partyBlock("Contratada", data.contratada)}
    </div>
  </section>

  <h2 class="section-title">Resumo dos pontos de ancoragem</h2>
  <table class="points-summary">
    <thead><tr><th>Tag</th><th>Modo</th><th>Resultado do teste</th></tr></thead>
    <tbody>
      ${data.anchorPoints
        .map(
          (p) =>
            `<tr><td>${escapeHtml(p.tag)}</td><td>${p.installation_mode ? INSTALLATION_LABEL[p.installation_mode] : "—"}</td><td class="result result-${p.test_result ?? ""}">${p.test_result ? TEST_RESULT_LABEL[p.test_result] : "—"}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2 class="section-title">Detalhamento por ponto</h2>
  ${data.anchorPoints.map((p, i) => anchorPointBlock(p, i)).join("")}

  <section class="signature-page">
    <h2>Assinatura do responsável técnico</h2>
    <div class="signature-block">
      <p><strong>${escapeHtml(data.engineer?.fullName ?? "—")}</strong></p>
      <p>CREA: ${escapeHtml(data.engineer?.creaNumber ?? "—")}</p>
      <p class="meta">Documento assinado digitalmente (ICP-Brasil)</p>
      <img class="qr" src="${data.verificationQrDataUrl}" alt="QR de verificação" style="height:30mm;" />
      <p class="meta">Escaneie para verificar a autenticidade deste laudo</p>
    </div>
  </section>
</body>
</html>`;
}

export function renderHeaderTemplate(reportName: string): string {
  return `
    <div style="font-size:8px; width:100%; padding:0 20mm; color:#8892A4; font-family: Arial, sans-serif; display:flex; justify-content:space-between;">
      <span>ZOPPI — ${escapeHtml(reportName)}</span>
    </div>`;
}

export function renderFooterTemplate(engineerName: string, creaNumber: string | null, reportNumber: string | null): string {
  return `
    <div style="font-size:8px; width:100%; padding:0 20mm; color:#8892A4; font-family: Arial, sans-serif; display:flex; justify-content:space-between;">
      <span>Resp. técnico: ${escapeHtml(engineerName)} · CREA ${escapeHtml(creaNumber)} · Laudo ${escapeHtml(reportNumber)}</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>`;
}
