import { Router } from "express";
import QRCode from "qrcode";
import { createReportSchema, normalizeCnpj, reportAttachmentConfirmSchema } from "@zoppi/shared";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { hasActiveModuleAccess } from "./accessGuard.js";
import { isDuplicateReportNumberError, nextReportNumber } from "./reportNumber.js";
import { signFieldToken, hashToken } from "../../middleware/fieldToken.js";
import { env } from "../../env.js";
import { withRetry } from "../../lib/retry.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

async function getAncoragemModuleId(): Promise<string> {
  const { data } = await supabaseAdmin.from("modules").select("id").eq("slug", "ancoragem").single();
  return data!.id;
}

reportsRouter.get("/", async (req, res) => {
  const { role, companyId } = req.user!;
  let query = supabaseAdmin.from("reports").select("*, companies(legal_name)").order("created_at", { ascending: false });
  if (role === "company_admin" || role === "company_operational") {
    query = query.eq("company_id", companyId);
  } else if (role === "zoppi_engineer") {
    query = query.eq("assigned_engineer_id", req.user!.id);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

reportsRouter.get("/:id", async (req, res) => {
  const { data: report, error } = await supabaseAdmin.from("reports").select("*").eq("id", req.params.id).single();
  if (error || !report) return res.status(404).json({ error: "Report not found" });
  if ((req.user!.role === "company_admin" || req.user!.role === "company_operational") && req.user!.companyId !== report.company_id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const [{ data: parties }, { data: anchorPoints }, { data: links }] = await Promise.all([
    supabaseAdmin.from("report_parties").select("*").eq("report_id", report.id),
    supabaseAdmin.from("anchor_points").select("*, photos(*)").eq("report_id", report.id).order("sort_order"),
    supabaseAdmin.from("report_field_links").select("id, status, purpose, expires_at, used_at").eq("report_id", report.id),
  ]);
  res.json({ report, parties, anchorPoints, fieldLinks: links });
});

// Distinct contratante/contratada records used in this company's past reports,
// so the wizard can offer them instead of retyping the same data every time.
reportsRouter.get("/parties/saved", async (req, res) => {
  const companyId = req.user!.companyId;
  if (!companyId) return res.json({ contratante: [], contratada: [] });

  const { data, error } = await supabaseAdmin
    .from("report_parties")
    .select("role, legal_name, cnpj, address, contact_name, contact_role, contact_phone, contact_email, reports!inner(company_id, created_at)")
    .eq("reports.company_id", companyId);
  if (error) return res.status(500).json({ error: error.message });

  const rows = [...(data ?? [])].sort(
    (a, b) => new Date((b.reports as any).created_at).getTime() - new Date((a.reports as any).created_at).getTime(),
  );

  const dedupe = (role: "contratante" | "contratada") => {
    const seen = new Set<string>();
    const result: Array<{ legalName: string; cnpj: string | null; address: string | null; contactName: string | null; contactRole: string | null; contactPhone: string | null; contactEmail: string | null }> = [];
    for (const row of rows) {
      if (row.role !== role || seen.has(row.legal_name)) continue;
      seen.add(row.legal_name);
      result.push({
        legalName: row.legal_name,
        cnpj: row.cnpj,
        address: row.address,
        contactName: row.contact_name,
        contactRole: row.contact_role,
        contactPhone: row.contact_phone,
        contactEmail: row.contact_email,
      });
    }
    return result;
  };

  res.json({ contratante: dedupe("contratante"), contratada: dedupe("contratada") });
});

// Distinct site (local do laudo) records used in this company's past reports,
// so the wizard can offer them instead of retyping the same location every time.
reportsRouter.get("/sites/saved", async (req, res) => {
  const companyId = req.user!.companyId;
  if (!companyId) return res.json([]);

  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("site_identification, site_address, created_at")
    .eq("company_id", companyId)
    .not("site_identification", "is", null)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const seen = new Set<string>();
  const result: { siteIdentification: string; siteAddress: string | null }[] = [];
  for (const row of data ?? []) {
    const identification = (row.site_identification ?? "").trim();
    if (!identification || seen.has(identification)) continue;
    seen.add(identification);
    result.push({ siteIdentification: identification, siteAddress: row.site_address });
  }

  res.json(result);
});

reportsRouter.post("/", requireRole("zoppi_admin", "zoppi_engineer", "company_admin", "company_operational"), async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  if ((req.user!.role === "company_admin" || req.user!.role === "company_operational") && req.user!.companyId !== input.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const moduleId = await getAncoragemModuleId();
  const hasAccess = await hasActiveModuleAccess(input.companyId, moduleId);
  if (!hasAccess) {
    return res.status(402).json({ error: "Assinatura do módulo Ancoragem inativa. Regularize para criar novos laudos." });
  }

  const { data: config } = await supabaseAdmin.from("app_config").select("value").eq("key", "report_default_validity_months").single();
  const validityMonths = (config?.value as number) ?? env.reportDefaultValidityMonths;
  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + validityMonths);

  // report_number is only a starting guess (see reportNumber.ts) — concurrent
  // creations can race for the same value, so retry with the next candidate
  // whenever the unique constraint rejects it, instead of blindly retrying
  // the same doomed insert.
  let report: { id: string; [key: string]: unknown } | undefined;
  try {
    for (let offset = 0; offset < 5; offset++) {
      const reportNumber = await nextReportNumber(offset);
      try {
        report = await withRetry(async () => {
          const r = await supabaseAdmin
            .from("reports")
            .insert({
              module_id: moduleId,
              company_id: input.companyId,
              name: input.name,
              description: input.description ?? null,
              site_address: input.siteAddress ?? null,
              site_identification: input.siteIdentification ?? null,
              site_area: input.siteArea ?? null,
              survey_date: input.surveyDate ?? null,
              status: "draft",
              report_number: reportNumber,
              valid_until: validUntil.toISOString(),
              created_by: req.user!.id,
            })
            .select()
            .single();
          if (r.error || !r.data) throw r.error ?? new Error("Failed to create report");
          return r.data;
        });
        break;
      } catch (err) {
        if (isDuplicateReportNumberError(err as { code?: string; message?: string })) continue;
        throw err;
      }
    }
    if (!report) throw new Error("Não foi possível gerar um número de laudo único.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao criar o laudo.";
    return res.status(502).json({ error: message });
  }

  try {
    await withRetry(async () => {
      const { error: partiesError } = await supabaseAdmin.from("report_parties").insert([
        { report_id: report.id, role: "contratante", ...toPartyRow(input.contratante) },
        { report_id: report.id, role: "contratada", ...toPartyRow(input.contratada) },
      ]);
      if (partiesError) throw partiesError;
    });
  } catch (partiesError) {
    // Don't leave a report behind with no contratante/contratada — that's a
    // broken, unusable draft the UI has no way to repair.
    await supabaseAdmin.from("reports").delete().eq("id", report.id);
    const message = partiesError instanceof Error ? partiesError.message : "Falha ao salvar as empresas do laudo.";
    return res.status(502).json({ error: `Não foi possível salvar as empresas do laudo, tente novamente. (${message})` });
  }

  res.status(201).json(report);
});

function toPartyRow(party: { companyId?: string; legalName: string; cnpj?: string; address?: string; contactName?: string; contactRole?: string; contactPhone?: string; contactEmail?: string }) {
  return {
    company_id: party.companyId ?? null,
    legal_name: party.legalName,
    cnpj: party.cnpj ? normalizeCnpj(party.cnpj) : null,
    address: party.address ?? null,
    contact_name: party.contactName ?? null,
    contact_role: party.contactRole ?? null,
    contact_phone: party.contactPhone ?? null,
    contact_email: party.contactEmail ?? null,
  };
}

// Generates (or regenerates, for corrections) a tokenized field link.
reportsRouter.post("/:id/field-links", requireRole("zoppi_admin", "zoppi_engineer", "company_admin", "company_operational"), async (req, res) => {
  const { data: report, error } = await supabaseAdmin.from("reports").select("*").eq("id", req.params.id).single();
  if (error || !report) return res.status(404).json({ error: "Report not found" });
  if ((req.user!.role === "company_admin" || req.user!.role === "company_operational") && req.user!.companyId !== report.company_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const purpose = (req.body?.purpose as string) === "correction" ? "correction" : "initial";
  const { data: config } = await supabaseAdmin.from("app_config").select("value").eq("key", "field_token_default_expiry_days").single();
  const expiryDays = (config?.value as number) ?? env.fieldTokenDefaultExpiryDays;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const { data: link, error: linkError } = await supabaseAdmin
    .from("report_field_links")
    .insert({ report_id: report.id, token_hash: "pending", purpose, expires_at: expiresAt.toISOString() })
    .select()
    .single();
  if (linkError) return res.status(400).json({ error: linkError.message });

  const token = signFieldToken({ linkId: link.id, reportId: report.id }, expiryDays);
  await supabaseAdmin.from("report_field_links").update({ token_hash: hashToken(token) }).eq("id", link.id);

  if (purpose === "initial" && report.status === "draft") {
    await supabaseAdmin.from("reports").update({ status: "awaiting_field" }).eq("id", report.id);
  } else if (purpose === "correction") {
    await supabaseAdmin.from("reports").update({ status: "awaiting_field" }).eq("id", report.id);
  }

  const fieldUrl = `${env.webAppBaseUrl}/f/${token}`;
  const qrDataUrl = await QRCode.toDataURL(fieldUrl, { margin: 1, width: 300 });

  res.status(201).json({ token, url: fieldUrl, qrDataUrl, expiresAt: link.expires_at });
});

// Requests generation of the report PDF / labels sheet (enqueues a job the
// worker in src/jobs/worker.ts picks up).
reportsRouter.post("/:id/pdf", async (req, res) => {
  const report = await authorizeReportAccess(req, res);
  if (!report) return;
  const kind = (req.body?.kind as string) === "labels" ? "labels" : "report";
  const { data: job, error } = await supabaseAdmin
    .from("pdf_jobs")
    .insert({ report_id: report.id, kind })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(202).json(job);
});

// Storage buckets are private; this returns a short-lived signed URL for the
// already-generated report or labels PDF.
reportsRouter.get("/:id/pdf-url", async (req, res) => {
  const kind = (req.query.kind as string) === "labels" ? "labels" : "report";
  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("pdf_url, labels_pdf_url, company_id")
    .eq("id", req.params.id)
    .single();
  if (error || !report) return res.status(404).json({ error: "Report not found" });
  if ((req.user!.role === "company_admin" || req.user!.role === "company_operational") && req.user!.companyId !== report.company_id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const path = kind === "labels" ? report.labels_pdf_url : report.pdf_url;
  if (!path) return res.status(404).json({ error: "PDF ainda não gerado" });
  const { data, error: signError } = await supabaseAdmin.storage.from("report-pdfs").createSignedUrl(path, 60 * 10);
  if (signError) return res.status(500).json({ error: signError.message });
  res.json({ url: data.signedUrl });
});

async function authorizeReportAccess(req: any, res: any): Promise<{ id: string; company_id: string } | null> {
  const { data: report, error } = await supabaseAdmin.from("reports").select("id, company_id").eq("id", req.params.id).single();
  if (error || !report) {
    res.status(404).json({ error: "Report not found" });
    return null;
  }
  if ((req.user!.role === "company_admin" || req.user!.role === "company_operational") && req.user!.companyId !== report.company_id) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return report;
}

// Attachments (master template annex index, section A): calibration
// certificates, datasheets, project memorials, lab reports, etc. Uploaded by
// staff or the subscriber company, listed in the PDF's annex index.
reportsRouter.get("/:id/attachments", async (req, res) => {
  const report = await authorizeReportAccess(req, res);
  if (!report) return;
  const { data, error } = await supabaseAdmin
    .from("report_attachments")
    .select("*")
    .eq("report_id", report.id)
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const withUrls = await Promise.all(
    (data ?? []).map(async (a) => {
      const { data: signed } = await supabaseAdmin.storage.from("report-attachments").createSignedUrl(a.storage_path, 60 * 10);
      return { ...a, url: signed?.signedUrl ?? null };
    }),
  );
  res.json(withUrls);
});

reportsRouter.post("/:id/attachments/upload-url", async (req, res) => {
  const report = await authorizeReportAccess(req, res);
  if (!report) return;
  const ext = (req.body?.ext as string) ?? "pdf";
  const path = `${report.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("report-attachments").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});

reportsRouter.post("/:id/attachments/confirm", async (req, res) => {
  const report = await authorizeReportAccess(req, res);
  if (!report) return;
  const parsed = reportAttachmentConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { data, error } = await supabaseAdmin
    .from("report_attachments")
    .insert({
      report_id: report.id,
      category: parsed.data.category,
      label: parsed.data.label,
      storage_path: parsed.data.path,
      uploaded_by: req.user!.id,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

reportsRouter.delete("/:id/attachments/:attachmentId", async (req, res) => {
  const report = await authorizeReportAccess(req, res);
  if (!report) return;
  const { data: attachment } = await supabaseAdmin.from("report_attachments").select("storage_path").eq("id", req.params.attachmentId).eq("report_id", report.id).single();
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });
  await supabaseAdmin.storage.from("report-attachments").remove([attachment.storage_path]);
  const { error } = await supabaseAdmin.from("report_attachments").delete().eq("id", req.params.attachmentId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

reportsRouter.get("/:id/pdf-status", async (req, res) => {
  const report = await authorizeReportAccess(req, res);
  if (!report) return;
  const kind = (req.query.kind as string) === "labels" ? "labels" : "report";
  const { data } = await supabaseAdmin
    .from("pdf_jobs")
    .select("*")
    .eq("report_id", report.id)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  res.json(data ?? { status: "none" });
});
