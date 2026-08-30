import { Router } from "express";
import type { Request } from "express";
import type { ZodType } from "zod";
import {
  registryClientSchema,
  registrySupplierSchema,
  registryServiceProviderSchema,
  registryEngineerSchema,
  registryEngineerDocumentSchema,
  registryEquipmentSchema,
  registryVehicleSchema,
} from "@zoppi/shared";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

// "Cadastro" registry: master data kept in the app — see
// supabase/migrations/0016_registry.sql / 0017_registry_ownership.sql.
//
// Clients/suppliers/service providers are always owned by a subscriber
// company (mountCrud below). Engineers/equipment/vehicles have a *dual*
// owner instead (mountOwnedCrud): either a company, or — when created by a
// zoppi_engineer — the engineer personally, since Zoppi's engineers aren't
// members of any one subscriber company but serve several of them.
export const registryRouter = Router();
registryRouter.use(requireAuth);

// Typed as `any` (not against Supabase's actual builder type) — that type is
// deep enough that checking it structurally against even a one-method shape
// blows up the compiler (TS2589).
function scopeToCompany(req: Request, query: any): any {
  if (req.user!.role === "zoppi_admin") {
    const companyId = req.query.companyId;
    return typeof companyId === "string" ? query.eq("company_id", companyId) : query;
  }
  return query.eq("company_id", req.user!.companyId ?? "");
}

// registry-documents is a private bucket, so reads go through a short-lived
// signed URL (same pattern as field-option-images) rather than a public one.
async function signedDocUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from("registry-documents").createSignedUrl(path, 60 * 60);
  if (error) {
    console.warn("Unable to create signed registry-document URL", error.message);
    return null;
  }
  return data.signedUrl;
}

// Clients, suppliers and service providers: always company-owned, always
// managed by zoppi_admin/company_admin only — a zoppi_engineer doesn't
// belong to a company, so these three sections just aren't for them (they
// don't even appear in their sidebar — see Sidebar.tsx).
function mountCrud(
  path: string,
  table: string,
  schema: ZodType<any>,
  editableFields: readonly string[],
) {
  registryRouter.get(path, async (req, res) => {
    if (req.user!.role !== "zoppi_admin" && !req.user!.companyId) return res.json([]);
    const { data, error } = await scopeToCompany(req, supabaseAdmin.from(table).select("*")).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  });

  registryRouter.post(path, requireRole("zoppi_admin", "company_admin"), async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const companyId = req.user!.role === "zoppi_admin" && req.body?.company_id ? (req.body.company_id as string) : req.user!.companyId;
    if (!companyId) return res.status(400).json({ error: "Usuário não vinculado a uma empresa." });
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert({ ...parsed.data, company_id: companyId })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  });

  registryRouter.patch(`${path}/:id`, requireRole("zoppi_admin", "company_admin"), async (req, res) => {
    const { data: existing, error: fetchError } = await supabaseAdmin.from(table).select("*").eq("id", req.params.id).single();
    if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
    if (req.user!.role === "company_admin" && existing.company_id !== req.user!.companyId) return res.status(403).json({ error: "Forbidden" });
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const field of editableFields) if (field in body) patch[field] = body[field];
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  registryRouter.delete(`${path}/:id`, requireRole("zoppi_admin", "company_admin"), async (req, res) => {
    const { data: existing, error: fetchError } = await supabaseAdmin.from(table).select("*").eq("id", req.params.id).single();
    if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
    if (req.user!.role === "company_admin" && existing.company_id !== req.user!.companyId) return res.status(403).json({ error: "Forbidden" });
    const { error } = await supabaseAdmin.from(table).delete().eq("id", req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.status(204).end();
  });
}

mountCrud(
  "/clients",
  "registry_clients",
  registryClientSchema,
  [
    "legal_name",
    "trade_name",
    "cnpj",
    "address_street",
    "address_number",
    "address_complement",
    "address_district",
    "address_city",
    "address_state",
    "address_zip",
    "contact_name",
    "contact_role",
    "contact_phone",
    "contact_email",
    "notes",
    "active",
  ],
);

mountCrud("/suppliers", "registry_suppliers", registrySupplierSchema, [
  "legal_name",
  "trade_name",
  "cnpj",
  "category",
  "address",
  "contact_name",
  "contact_phone",
  "contact_email",
  "notes",
  "active",
]);

mountCrud("/service-providers", "registry_service_providers", registryServiceProviderSchema, [
  "name",
  "document_type",
  "document_number",
  "service_type",
  "address",
  "contact_phone",
  "contact_email",
  "notes",
  "active",
]);

// --- Engineers / equipment / vehicles: dual ownership ---

interface Owned {
  company_id: string | null;
  owner_user_id: string | null;
}

// Companies a zoppi_engineer has actually served — derived from
// reports.assigned_engineer_id (the same link review/routes.ts sets when a
// laudo is assigned to/signed by an engineer), so no separate junction table
// is needed just to answer "which engineers has this company worked with".
async function attendedEngineerIds(companyId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("reports")
    .select("assigned_engineer_id")
    .eq("company_id", companyId)
    .not("assigned_engineer_id", "is", null);
  return [...new Set((data ?? []).map((r: any) => r.assigned_engineer_id as string))];
}

// Seeing a personal record (because the engineer has served your company) is
// not the same as being allowed to change it — only the owning company, the
// engineer themselves, or Zoppi staff can write.
function canWriteOwned(req: Request, row: Owned): boolean {
  if (req.user!.role === "zoppi_admin") return true;
  if (row.company_id) return req.user!.role === "company_admin" && row.company_id === req.user!.companyId;
  return row.owner_user_id === req.user!.id;
}

function mountOwnedCrud(
  path: string,
  table: string,
  schema: ZodType<any>,
  editableFields: readonly string[],
  options: { decorate?: <T extends Record<string, unknown>>(row: T) => Promise<T>; withDocumentUpload?: boolean } = {},
) {
  const { decorate, withDocumentUpload = false } = options;
  const apply = <T extends Record<string, unknown>>(row: T) => (decorate ? decorate(row) : Promise.resolve(row));

  registryRouter.get(path, async (req, res) => {
    const role = req.user!.role;
    let query = supabaseAdmin.from(table).select("*");
    if (role === "zoppi_admin") {
      const companyId = req.query.companyId;
      if (typeof companyId === "string") query = query.eq("company_id", companyId);
    } else if (role === "zoppi_engineer") {
      query = query.eq("owner_user_id", req.user!.id);
    } else {
      const companyId = req.user!.companyId;
      if (!companyId) return res.json([]);
      const engineerIds = await attendedEngineerIds(companyId);
      const orParts = [`company_id.eq.${companyId}`];
      if (engineerIds.length > 0) orParts.push(`owner_user_id.in.(${engineerIds.join(",")})`);
      query = query.or(orParts.join(","));
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(await Promise.all((data ?? []).map(apply)));
  });

  registryRouter.post(path, requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    let ownership: Owned;
    if (req.user!.role === "zoppi_engineer") {
      // Always personal — a zoppi_engineer serves many companies, so this
      // never belongs to just one of them (see Sidebar.tsx / plan notes).
      ownership = { company_id: null, owner_user_id: req.user!.id };
    } else if (req.user!.role === "zoppi_admin") {
      const companyId = req.body?.company_id as string | undefined;
      if (!companyId) return res.status(400).json({ error: "Selecione a empresa." });
      ownership = { company_id: companyId, owner_user_id: null };
    } else {
      if (!req.user!.companyId) return res.status(400).json({ error: "Usuário não vinculado a uma empresa." });
      ownership = { company_id: req.user!.companyId, owner_user_id: null };
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .insert({ ...parsed.data, ...ownership })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(await apply(data));
  });

  registryRouter.patch(`${path}/:id`, requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
    const { data: existing, error: fetchError } = await supabaseAdmin.from(table).select("*").eq("id", req.params.id).single();
    if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
    if (!canWriteOwned(req, existing)) return res.status(403).json({ error: "Forbidden" });
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const field of editableFields) if (field in body) patch[field] = body[field];
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(await apply(data));
  });

  registryRouter.delete(`${path}/:id`, requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
    const { data: existing, error: fetchError } = await supabaseAdmin.from(table).select("*").eq("id", req.params.id).single();
    if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
    if (!canWriteOwned(req, existing)) return res.status(403).json({ error: "Forbidden" });
    const { error } = await supabaseAdmin.from(table).delete().eq("id", req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.status(204).end();
  });

  // Returns a signed upload URL for a single document field on this table
  // (calibration certificate, CRLV, etc.) — the client PUTs the file then
  // PATCHes the record with the returned path, same flow as accessory images.
  if (withDocumentUpload) {
    registryRouter.post(`${path}/:id/document-upload-url`, requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
      const { data: existing, error: fetchError } = await supabaseAdmin.from(table).select("*").eq("id", req.params.id).single();
      if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
      if (!canWriteOwned(req, existing)) return res.status(403).json({ error: "Forbidden" });
      const ext = (req.body?.ext as string) ?? "pdf";
      const path = `${table}/${req.params.id}/${Date.now()}.${ext}`;
      const { data, error } = await supabaseAdmin.storage.from("registry-documents").createSignedUploadUrl(path);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ path, token: data.token, signedUrl: data.signedUrl });
    });
  }
}

mountOwnedCrud(
  "/engineers",
  "registry_engineers",
  registryEngineerSchema,
  ["full_name", "crea_number", "crea_state", "email", "phone", "specialty", "user_id", "notes", "active"],
);

mountOwnedCrud(
  "/equipment",
  "registry_equipment",
  registryEquipmentSchema,
  [
    "name",
    "category",
    "manufacturer",
    "model",
    "serial_number",
    "capacity_kgf",
    "calibration_certificate_path",
    "calibration_issued_at",
    "calibration_expires_at",
    "notes",
    "active",
  ],
  {
    decorate: async (row) => ({ ...row, calibration_certificate_url: await signedDocUrl(row.calibration_certificate_path as string | null) }),
    withDocumentUpload: true,
  },
);

mountOwnedCrud(
  "/vehicles",
  "registry_vehicles",
  registryVehicleSchema,
  ["plate", "brand", "model", "year", "kind", "document_path", "insurance_expires_at", "notes", "active"],
  { decorate: async (row) => ({ ...row, document_url: await signedDocUrl(row.document_path as string | null) }), withDocumentUpload: true },
);

// --- Engineer documents (parent/child, so it falls outside mountOwnedCrud) ---

registryRouter.get("/engineers/:engineerId/documents", async (req, res) => {
  const { data: engineer, error: engineerError } = await supabaseAdmin
    .from("registry_engineers")
    .select("*")
    .eq("id", req.params.engineerId)
    .single();
  if (engineerError || !engineer) return res.status(404).json({ error: "Engenheiro não encontrado" });

  const role = req.user!.role;
  let visible = role === "zoppi_admin";
  if (!visible && role === "zoppi_engineer") visible = engineer.owner_user_id === req.user!.id;
  if (!visible && req.user!.companyId) {
    visible =
      engineer.company_id === req.user!.companyId ||
      (engineer.owner_user_id && (await attendedEngineerIds(req.user!.companyId)).includes(engineer.owner_user_id));
  }
  if (!visible) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabaseAdmin
    .from("registry_engineer_documents")
    .select("*")
    .eq("engineer_id", req.params.engineerId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const withUrls = await Promise.all((data ?? []).map(async (doc: any) => ({ ...doc, storage_url: await signedDocUrl(doc.storage_path) })));
  res.json(withUrls);
});

registryRouter.post("/engineers/:engineerId/documents", requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
  const { data: engineer, error: engineerError } = await supabaseAdmin
    .from("registry_engineers")
    .select("*")
    .eq("id", req.params.engineerId)
    .single();
  if (engineerError || !engineer) return res.status(404).json({ error: "Engenheiro não encontrado" });
  if (!canWriteOwned(req, engineer)) return res.status(403).json({ error: "Forbidden" });

  const parsed = registryEngineerDocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data, error } = await supabaseAdmin
    .from("registry_engineer_documents")
    .insert({ ...parsed.data, engineer_id: engineer.id, company_id: engineer.company_id, owner_user_id: engineer.owner_user_id })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ ...data, storage_url: null });
});

registryRouter.post("/engineer-documents/:id/upload-url", requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("registry_engineer_documents").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (!canWriteOwned(req, existing)) return res.status(403).json({ error: "Forbidden" });
  const ext = (req.body?.ext as string) ?? "pdf";
  const path = `engineer-documents/${req.params.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("registry-documents").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});

const ENGINEER_DOCUMENT_EDITABLE_FIELDS = ["doc_type", "label", "storage_path", "issued_at", "expires_at", "notes"] as const;

registryRouter.patch("/engineer-documents/:id", requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("registry_engineer_documents").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (!canWriteOwned(req, existing)) return res.status(403).json({ error: "Forbidden" });
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const field of ENGINEER_DOCUMENT_EDITABLE_FIELDS) if (field in body) patch[field] = body[field];
  const { data, error } = await supabaseAdmin.from("registry_engineer_documents").update(patch).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ...data, storage_url: await signedDocUrl(data.storage_path) });
});

registryRouter.delete("/engineer-documents/:id", requireRole("zoppi_admin", "zoppi_engineer", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("registry_engineer_documents").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (!canWriteOwned(req, existing)) return res.status(403).json({ error: "Forbidden" });
  const { error } = await supabaseAdmin.from("registry_engineer_documents").delete().eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});
