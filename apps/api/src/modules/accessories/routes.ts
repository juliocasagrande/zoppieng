import { Router } from "express";
import { accessoryCatalogItemSchema } from "@zoppi/shared";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const accessoriesRouter = Router();
accessoriesRouter.use(requireAuth);

function withImageUrl<T extends { image_path: string | null }>(item: T): T & { image_url: string | null } {
  const image_url = item.image_path
    ? supabaseAdmin.storage.from("accessory-images").getPublicUrl(item.image_path).data.publicUrl
    : null;
  return { ...item, image_url };
}

// Combined catalog: Zoppi standard items + this company's custom items.
accessoriesRouter.get("/", async (req, res) => {
  const companyId = req.user!.companyId;
  let query = supabaseAdmin.from("accessory_catalog").select("*").eq("active", true);
  if (req.user!.role === "zoppi_admin" || req.user!.role === "zoppi_engineer") {
    query = supabaseAdmin.from("accessory_catalog").select("*");
  } else {
    query = query.or(`scope.eq.zoppi_standard,company_id.eq.${companyId}`);
  }
  const { data, error } = await query.order("name");
  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(withImageUrl));
});

accessoriesRouter.post("/", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const parsed = accessoryCatalogItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  const isZoppiStandard = req.user!.role === "zoppi_admin" && req.body.scope === "zoppi_standard";

  const { data, error } = await supabaseAdmin
    .from("accessory_catalog")
    .insert({
      scope: isZoppiStandard ? "zoppi_standard" : "company_custom",
      company_id: isZoppiStandard ? null : req.user!.companyId,
      name: input.name,
      category: input.category,
      manufacturer: input.manufacturer ?? null,
      spec_diameter_mm: input.specDiameterMm ?? null,
      spec_load_capacity_kn: input.specLoadCapacityKn ?? null,
      spec_notes: input.specNotes ?? null,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(withImageUrl(data));
});

// Returns a signed upload URL for the item's thumbnail; the client uploads
// directly to Supabase Storage, then PATCHes { image_path: path } to attach it.
accessoriesRouter.post("/:id/image-upload-url", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("accessory_catalog").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === "company_admin" && existing.company_id !== req.user!.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const ext = (req.body?.ext as string) ?? "jpg";
  const path = `${req.params.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("accessory-images").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});

const ACCESSORY_EDITABLE_FIELDS = ["name", "category", "manufacturer", "spec_diameter_mm", "spec_load_capacity_kn", "spec_notes", "image_path", "active"] as const;

accessoriesRouter.patch("/:id", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("accessory_catalog").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === "company_admin" && existing.company_id !== req.user!.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const field of ACCESSORY_EDITABLE_FIELDS) {
    if (field in body) patch[field] = body[field];
  }
  const { data, error } = await supabaseAdmin
    .from("accessory_catalog")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(withImageUrl(data));
});

// Certificates — support multi-page/multi-item: one certificate record with
// several storage files, linkable to several accessory_catalog rows.
accessoriesRouter.post("/certificates", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const { title, issuedBy, issuedAt, expiresAt, accessoryIds } = req.body as {
    title: string;
    issuedBy?: string;
    issuedAt?: string;
    expiresAt?: string;
    accessoryIds: string[];
  };
  const { data: cert, error } = await supabaseAdmin
    .from("accessory_certificates")
    .insert({ title, issued_by: issuedBy ?? null, issued_at: issuedAt ?? null, expires_at: expiresAt ?? null })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });

  if (accessoryIds?.length) {
    await supabaseAdmin.from("accessory_certificate_links").insert(accessoryIds.map((id) => ({ certificate_id: cert.id, accessory_id: id })));
  }
  res.status(201).json(cert);
});

accessoriesRouter.post("/certificates/:id/upload-url", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const ext = (req.body?.ext as string) ?? "pdf";
  const pageOrder = Number(req.body?.pageOrder ?? 1);
  const path = `${req.params.id}/${pageOrder}-${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("accessory-certificates").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  await supabaseAdmin.from("accessory_certificate_files").insert({ certificate_id: req.params.id, storage_path: path, page_order: pageOrder });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});

accessoriesRouter.get("/certificates/:id", async (req, res) => {
  const { data: cert } = await supabaseAdmin.from("accessory_certificates").select("*").eq("id", req.params.id).single();
  const { data: files } = await supabaseAdmin.from("accessory_certificate_files").select("*").eq("certificate_id", req.params.id).order("page_order");
  const { data: links } = await supabaseAdmin.from("accessory_certificate_links").select("accessory_id").eq("certificate_id", req.params.id);
  res.json({ certificate: cert, files, accessoryIds: (links ?? []).map((l) => l.accessory_id) });
});
