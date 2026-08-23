import puppeteer from "puppeteer";
import { supabaseAdmin } from "../lib/supabase.js";

// Simple printable sheet of anchor point tags (grid of labels) — section 4.6.
export async function generateLabelsPdf(reportId: string): Promise<Buffer> {
  const { data: report } = await supabaseAdmin.from("reports").select("name, report_number").eq("id", reportId).single();
  const { data: points } = await supabaseAdmin
    .from("anchor_points")
    .select("tag")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true });

  const labels = (points ?? [])
    .map(
      (p) => `
      <div class="label">
        <div class="tag">${p.tag}</div>
        <div class="ref">${report?.report_number ?? ""}</div>
      </div>`,
    )
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  @page { size: A4; margin: 10mm; }
  body { font-family: Arial, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .label { border: 2px dashed #8892A4; border-radius: 4px; padding: 6mm; text-align: center; break-inside: avoid; }
  .tag { font-size: 22pt; font-weight: 800; color: #151F5C; }
  .ref { font-size: 8pt; color: #8892A4; margin-top: 2mm; }
</style></head>
<body><div class="grid">${labels}</div></body></html>`;

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
