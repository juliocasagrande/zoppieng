import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getSignatureProvider } from "../../providers/signature/index.js";
import { generateReportPdf } from "../../pdf/generateReportPdf.js";
import { getNotificationProvider } from "../../providers/notification/index.js";

export const reviewRouter = Router();
reviewRouter.use(requireAuth, requireRole("zoppi_admin", "zoppi_engineer"));

reviewRouter.get("/queue", async (req, res) => {
  let query = supabaseAdmin
    .from("reports")
    .select("*, companies(legal_name)")
    .in("status", ["in_review"])
    .order("created_at");
  if (req.user!.role === "zoppi_engineer") {
    query = query.or(`assigned_engineer_id.is.null,assigned_engineer_id.eq.${req.user!.id}`);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Simple round-robin assignment among active engineers (spec section 6:
// "critério exato... a definir com o time" — this is the default).
reviewRouter.post("/:id/assign", async (req, res) => {
  const engineerId = (req.body?.engineerId as string) ?? (await pickNextEngineer());
  if (!engineerId) return res.status(400).json({ error: "No engineer available" });
  const { data, error } = await supabaseAdmin
    .from("reports")
    .update({ assigned_engineer_id: engineerId, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

async function pickNextEngineer(): Promise<string | null> {
  const { data: engineers } = await supabaseAdmin.from("users").select("id").eq("role", "zoppi_engineer").eq("active", true);
  if (!engineers?.length) return null;
  const { count } = await supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).not("assigned_engineer_id", "is", null);
  return engineers[(count ?? 0) % engineers.length].id;
}

reviewRouter.post("/:id/approve", async (req, res) => {
  const reportId = req.params.id;
  const { data: report, error } = await supabaseAdmin.from("reports").select("*").eq("id", reportId).single();
  if (error || !report) return res.status(404).json({ error: "Report not found" });

  const { data: engineer } = await supabaseAdmin.from("users").select("full_name, crea_number").eq("id", req.user!.id).single();

  await supabaseAdmin.from("reports").update({ assigned_engineer_id: req.user!.id, issued_at: new Date().toISOString() }).eq("id", reportId);

  const pdfBuffer = await generateReportPdf(reportId);
  const signatureProvider = getSignatureProvider();
  const signResult = await signatureProvider.sign({
    reportId,
    engineerId: req.user!.id,
    engineerName: engineer?.full_name ?? req.user!.fullName,
    engineerCrea: engineer?.crea_number ?? null,
    documentBuffer: pdfBuffer,
  });

  await supabaseAdmin.from("signatures").insert({
    report_id: reportId,
    engineer_id: req.user!.id,
    provider: signResult.provider,
    provider_reference: signResult.providerReference,
    document_hash: signResult.documentHash,
    signed_at: signResult.signedAt,
  });

  const path = `${reportId}/laudo.pdf`;
  await supabaseAdmin.storage.from("report-pdfs").upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });

  await supabaseAdmin
    .from("reports")
    .update({ status: "signed", pdf_url: path, updated_at: new Date().toISOString() })
    .eq("id", reportId);

  const { data: companyInfo } = await supabaseAdmin.from("companies").select("contact_email").eq("id", report.company_id).single();
  if (companyInfo?.contact_email) {
    const provider = getNotificationProvider("email");
    const sendResult = await provider.send({
      to: companyInfo.contact_email,
      subject: `Zoppi — laudo "${report.name}" assinado`,
      body: `<p>O laudo <strong>${report.name}</strong> foi assinado pelo engenheiro responsável e já está disponível no painel Zoppi.</p>`,
    });
    await supabaseAdmin.from("notifications_log").insert({
      report_id: reportId,
      channel: "email",
      event_type: "signed",
      recipient: companyInfo.contact_email,
      status: sendResult.status,
      provider_reference: sendResult.providerReference,
    });
  }

  res.json({ ok: true });
});

// Reopens the field flow for the technician to complete/fix data, without
// redoing the whole report.
reviewRouter.post("/:id/request-changes", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .update({ status: "changes_requested", updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

reviewRouter.post("/:id/reject", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
