import "dotenv/config";
import { supabaseAdmin } from "../lib/supabase.js";
import { generateReportPdf } from "../pdf/generateReportPdf.js";
import { generateLabelsPdf as genLabels } from "../pdf/generateLabelsPdf.js";
import { getNotificationProvider } from "../providers/notification/index.js";
import { runRevalidationReminders } from "./reminders.js";

const POLL_INTERVAL_MS = 5000;
const REMINDERS_INTERVAL_MS = 1000 * 60 * 60 * 6; // every 6h is enough for day-granularity reminders
let lastRemindersRun = 0;

async function processPdfJob(job: { id: string; report_id: string; kind: string }) {
  await supabaseAdmin.from("pdf_jobs").update({ status: "processing" }).eq("id", job.id);
  try {
    if (job.kind === "labels") {
      const pdf = await genLabels(job.report_id);
      const path = `${job.report_id}/labels.pdf`;
      await supabaseAdmin.storage.from("report-pdfs").upload(path, pdf, { contentType: "application/pdf", upsert: true });
      await supabaseAdmin.from("reports").update({ labels_pdf_url: path }).eq("id", job.report_id);
    } else {
      const pdf = await generateReportPdf(job.report_id);
      const path = `${job.report_id}/laudo.pdf`;
      await supabaseAdmin.storage.from("report-pdfs").upload(path, pdf, { contentType: "application/pdf", upsert: true });
      await supabaseAdmin.from("reports").update({ pdf_url: path }).eq("id", job.report_id);
    }
    await supabaseAdmin.from("pdf_jobs").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", job.id);
  } catch (err) {
    console.error(`[pdf_jobs] job ${job.id} failed`, err);
    await supabaseAdmin
      .from("pdf_jobs")
      .update({ status: "failed", error: String(err), attempts: (job as any).attempts + 1 })
      .eq("id", job.id);
  }
}

async function processNotificationJob(job: { id: string; channel: "email" | "whatsapp"; recipient: string; payload: any }) {
  await supabaseAdmin.from("notification_jobs").update({ status: "processing" }).eq("id", job.id);
  try {
    const provider = getNotificationProvider(job.channel);
    const result = await provider.send({ to: job.recipient, subject: job.payload?.subject, body: job.payload?.body ?? "" });
    await supabaseAdmin
      .from("notification_jobs")
      .update({ status: result.status === "sent" ? "done" : "failed", error: result.error ?? null, processed_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (err) {
    console.error(`[notification_jobs] job ${job.id} failed`, err);
    await supabaseAdmin.from("notification_jobs").update({ status: "failed", error: String(err) }).eq("id", job.id);
  }
}

async function tick() {
  const { data: pdfJobs } = await supabaseAdmin.from("pdf_jobs").select("*").eq("status", "pending").limit(5);
  for (const job of pdfJobs ?? []) await processPdfJob(job as any);

  const { data: notifJobs } = await supabaseAdmin.from("notification_jobs").select("*").eq("status", "pending").limit(10);
  for (const job of notifJobs ?? []) await processNotificationJob(job as any);

  if (Date.now() - lastRemindersRun > REMINDERS_INTERVAL_MS) {
    lastRemindersRun = Date.now();
    await runRevalidationReminders();
  }
}

// Table-backed queue poller (spec section 8: "fila simples baseada em tabela
// no Postgres, evoluindo para BullMQ + Redis se o volume justificar").
async function main() {
  console.log("[jobs worker] started, polling every", POLL_INTERVAL_MS, "ms");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
    } catch (err) {
      console.error("[jobs worker] tick failed", err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
