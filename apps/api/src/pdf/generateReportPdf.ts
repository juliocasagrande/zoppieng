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

export async function buildReportPdfData(reportId: string): Promise<ReportPdfData> {
  const { data: report, error } = await supabaseAdmin.from("reports").select("*").eq("id", reportId).single();
  if (error || !report) throw new Error(`Report not found: ${reportId}`);

  const [{ data: parties }, { data: points }, { data: engineerUser }, { data: company }] = await Promise.all([
    supabaseAdmin.from("report_parties").select("*").eq("report_id", reportId),
    supabaseAdmin
      .from("anchor_points")
      .select("*, accessory_catalog(name), photos(*)")
      .eq("report_id", reportId)
      .order("sort_order", { ascending: true }),
    report.assigned_engineer_id
      ? supabaseAdmin.from("users").select("full_name, crea_number").eq("id", report.assigned_engineer_id).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("companies")
      .select("logo_path, brand_primary_color, brand_secondary_color, pdf_header_text, pdf_footer_text")
      .eq("id", report.company_id)
      .single(),
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
    (points ?? []).map(async (p: any) => ({
      ...p,
      accessoryName: p.accessory_catalog?.name ?? null,
      photoUrls: await Promise.all((p.photos ?? []).map((ph: any) => signedUrl("report-photos", ph.storage_path))),
    })),
  );

  const verificationUrl = `${env.webAppBaseUrl}/verify/${reportId}`;
  const verificationQrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 300 });

  return {
    report,
    contratante: (parties ?? []).find((p) => p.role === "contratante") ?? null,
    contratada: (parties ?? []).find((p) => p.role === "contratada") ?? null,
    anchorPoints,
    engineer: engineerUser ? { fullName: engineerUser.full_name, creaNumber: engineerUser.crea_number } : null,
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
