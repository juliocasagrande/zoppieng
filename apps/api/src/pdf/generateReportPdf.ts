import puppeteer from "puppeteer";
import QRCode from "qrcode";
import { DEFAULT_BRAND_PRIMARY_COLOR, DEFAULT_BRAND_SECONDARY_COLOR } from "@zoppi/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { env } from "../env.js";
import { renderFooterTemplate, renderHeaderTemplate, renderReportHtml, type ReportBrand, type ReportPdfData } from "./reportTemplate.js";
import { ZOPPI_LOGO_DATA_URL } from "./logo.js";

async function signedUrl(bucket: string, path: string): Promise<string> {
  const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? "";
}

// Photos captured in the field carry a kind-derived caption ("Foto do ponto
// de ancoragem", "Foto do teste…", "Foto complementar") set at upload time —
// see FieldWizard.tsx / offline/sync.ts. Falls back to a generic "foto N de
// M" only for legacy photos that predate that caption.
function photoCaption(caption: string | null, tag: string, index: number, total: number): string {
  if (caption) return `${tag} — ${caption}`;
  return `${tag} — foto ${index + 1} de ${total}`;
}

// kN -> kgf, used to show a reference load when the field technician (who
// only records the load actually applied) didn't capture one, but the linked
// accessory's catalog spec has a rated capacity.
const KN_TO_KGF = 101.97;

export async function buildReportPdfData(reportId: string): Promise<ReportPdfData> {
  const { data: report, error } = await supabaseAdmin.from("reports").select("*").eq("id", reportId).single();
  if (error || !report) throw new Error(`Report not found: ${reportId}`);

  const [{ data: parties }, { data: points }, { data: engineerUser }, { data: company }, { data: attachments }, { data: extraPhotos }] = await Promise.all([
    supabaseAdmin.from("report_parties").select("*").eq("report_id", reportId),
    supabaseAdmin
      .from("anchor_points")
      .select("*, accessory_catalog(name, spec_load_capacity_kn), photos(*)")
      .eq("report_id", reportId)
      .order("sort_order", { ascending: true }),
    report.assigned_engineer_id
      ? supabaseAdmin.from("users").select("full_name, crea_number, signature_path").eq("id", report.assigned_engineer_id).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("companies")
      .select("logo_path, brand_primary_color, brand_secondary_color, pdf_header_text, pdf_footer_text")
      .eq("id", report.company_id)
      .single(),
    supabaseAdmin.from("report_attachments").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
    // Photos captured without a linked anchor point ("foto complementar" in
    // the field wizard) — the master laudo template (docx, section 8) shows
    // these separately from the per-point evidence in section 7.
    supabaseAdmin.from("photos").select("*").eq("report_id", reportId).is("anchor_point_id", null).order("sort_order", { ascending: true }),
  ]);

  // Subscriber companies can white-label the laudo with their own logo and
  // colors; falls back to the Zoppi look when they haven't set one.
  const logoUrl = company?.logo_path ? supabaseAdmin.storage.from("company-logos").getPublicUrl(company.logo_path).data.publicUrl : ZOPPI_LOGO_DATA_URL;
  const brand: ReportBrand = {
    logoUrl,
    primaryColor: company?.brand_primary_color || DEFAULT_BRAND_PRIMARY_COLOR,
    secondaryColor: company?.brand_secondary_color || DEFAULT_BRAND_SECONDARY_COLOR,
    headerText: company?.pdf_header_text ?? null,
    footerText: company?.pdf_footer_text ?? null,
  };

  const anchorPoints = await Promise.all(
    (points ?? []).map(async (p: any) => {
      const photoRows: any[] = p.photos ?? [];
      const photoUrls = await Promise.all(
        photoRows.map(async (ph, i) => ({ url: await signedUrl("report-photos", ph.storage_path), caption: photoCaption(ph.caption ?? null, p.tag, i, photoRows.length) })),
      );
      const accessoryCapacityKn = p.accessory_catalog?.spec_load_capacity_kn ?? null;
      return {
        ...p,
        accessoryName: p.accessory_catalog?.name ?? null,
        referenceLoadKgf: p.test_reference_load_kgf ?? (accessoryCapacityKn ? Math.round(accessoryCapacityKn * KN_TO_KGF) : null),
        photoUrls,
      };
    }),
  );

  let engineerSignatureUrl: string | null = null;
  if (engineerUser?.signature_path) {
    const { data, error } = await supabaseAdmin.storage.from("engineer-signatures").createSignedUrl(engineerUser.signature_path, 15 * 60);
    if (error) console.warn("Unable to create signed PDF signature URL", error.message);
    else engineerSignatureUrl = data.signedUrl;
  }

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (a) => ({ ...a, url: await signedUrl("report-attachments", a.storage_path) })),
  );

  const complementaryPhotoRows: any[] = extraPhotos ?? [];
  const complementaryPhotos = await Promise.all(
    complementaryPhotoRows.map(async (ph, i) => ({
      url: await signedUrl("report-photos", ph.storage_path),
      caption: photoCaption(ph.caption ?? null, "Complementar", i, complementaryPhotoRows.length),
    })),
  );

  const verificationUrl = `${env.webAppBaseUrl}/verify/${reportId}`;
  const verificationQrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 300 });

  return {
    report,
    contratante: (parties ?? []).find((p) => p.role === "contratante") ?? null,
    contratada: (parties ?? []).find((p) => p.role === "contratada") ?? null,
    anchorPoints,
    engineer: engineerUser ? { fullName: engineerUser.full_name, creaNumber: engineerUser.crea_number, signatureUrl: engineerSignatureUrl } : null,
    attachments: attachmentsWithUrls,
    complementaryPhotos,
    verificationQrDataUrl,
    brand,
  };
}

export async function generateReportPdf(reportId: string): Promise<Buffer> {
  const data = await buildReportPdfData(reportId);
  const html = renderReportHtml(data);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "25mm", bottom: "20mm", left: "20mm", right: "20mm" },
      displayHeaderFooter: true,
      headerTemplate: renderHeaderTemplate(data.brand, data.report.name),
      footerTemplate: renderFooterTemplate(
        data.brand,
        data.engineer?.fullName ?? "—",
        data.engineer?.creaNumber ?? null,
        data.report.report_number,
      ),
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
