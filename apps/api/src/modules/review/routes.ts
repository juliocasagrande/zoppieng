import { Router } from "express";
import { confirmPointResultSchema, reviewDetailsSchema } from "@zoppi/shared";
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

// The field technician's testResult (submitted via /field/:token/submit) is
// only ever a suggestion — the laudo's actual pass/fail verdict is the
// engineer's professional judgment, recorded here per point during review.
// approve/ below refuses to sign until every point has one of these.
reviewRouter.patch("/:reportId/points/:pointId", async (req, res) => {
  const parsed = confirmPointResultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data: point, error: fetchError } = await supabaseAdmin.from("anchor_points").select("id, report_id").eq("id", req.params.pointId).single();
  if (fetchError || !point || point.report_id !== req.params.reportId) return res.status(404).json({ error: "Anchor point not found" });

  const { data, error } = await supabaseAdmin
    .from("anchor_points")
    .update({
      test_result: parsed.data.testResult,
      result_confirmed_by: req.user!.id,
      result_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.pointId)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Lets the assigned engineer author/curate the narrative and tabular
// sections of the master laudo template (objective/scope, ART/revision,
// rastreabilidade dos componentes, checklist C/NC/NA, não conformidades,
// controle de revisões, histórico de inspeções) before approving.
reviewRouter.patch("/:id/details", async (req, res) => {
  const parsed = reviewDetailsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.artNumber !== undefined) patch.art_number = input.artNumber;
  if (input.osContractNumber !== undefined) patch.os_contract_number = input.osContractNumber;
  if (input.revision !== undefined) patch.revision = input.revision;
  if (input.objectiveText !== undefined) patch.objective_text = input.objectiveText;
  if (input.scopeText !== undefined) patch.scope_text = input.scopeText;
  if (input.recommendationsText !== undefined) patch.recommendations_text = input.recommendationsText;
  if (input.conclusionText !== undefined) patch.conclusion_text = input.conclusionText;
  if (input.verificationChecks !== undefined) patch.verification_checks = input.verificationChecks;
  if (input.components !== undefined) patch.components = input.components;
  if (input.nonconformities !== undefined) patch.nonconformities = input.nonconformities;
  if (input.revisions !== undefined) patch.revisions = input.revisions;
  if (input.inspectionHistory !== undefined) patch.inspection_history = input.inspectionHistory;

  const { data, error } = await supabaseAdmin.from("reports").update(patch).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

reviewRouter.post("/:id/approve", async (req, res) => {
  const reportId = req.params.id;
  const { data: report, error } = await supabaseAdmin.from("reports").select("*").eq("id", reportId).single();
  if (error || !report) return res.status(404).json({ error: "Report not found" });

  const { data: points } = await supabaseAdmin.from("anchor_points").select("id, tag, result_confirmed_at").eq("report_id", reportId);
  const unconfirmed = (points ?? []).filter((p) => !p.result_confirmed_at);
  if (unconfirmed.length > 0) {
    return res.status(400).json({
      error: `Confirme o resultado de todos os pontos antes de assinar. Pendente(s): ${unconfirmed.map((p) => p.tag).join(", ")}.`,
    });
  }

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
