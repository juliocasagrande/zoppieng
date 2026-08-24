import { Router } from "express";
import { fieldOptionCatalogItemSchema, fieldOptionKeySchema } from "@zoppi/shared";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

// Customizable, image-illustrated option catalogs for the field wizard's
// selection fields (device type, system type, support structure, environment
// condition) — same scope/company_custom shape as accessories/routes.ts,
// generalized across fields via field_key instead of one table per field.
export const fieldOptionsRouter = Router();
fieldOptionsRouter.use(requireAuth);

function withImageUrl<T extends { image_path: string | null }>(item: T): T & { image_url: string | null } {
  const image_url = item.image_path ? supabaseAdmin.storage.from("field-option-images").getPublicUrl(item.image_path).data.publicUrl : null;
  return { ...item, image_url };
}

// Combined catalog: Zoppi standard items + this company's custom items,
// optionally filtered to one field via ?fieldKey=.
fieldOptionsRouter.get("/", async (req, res) => {
  const companyId = req.user!.companyId;
  const fieldKeyParsed = fieldOptionKeySchema.safeParse(req.query.fieldKey);

  let query = supabaseAdmin.from("field_option_catalog").select("*").eq("active", true);
  if (req.user!.role !== "zoppi_admin" && req.user!.role !== "zoppi_engineer") {
    query = query.or(`scope.eq.zoppi_standard,company_id.eq.${companyId}`);
  }
  if (fieldKeyParsed.success) query = query.eq("field_key", fieldKeyParsed.data);

  const { data, error } = await query.order("sort_order").order("label");
  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(withImageUrl));
});

fieldOptionsRouter.post("/", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const parsed = fieldOptionCatalogItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  const isZoppiStandard = req.user!.role === "zoppi_admin" && req.body.scope === "zoppi_standard";

  const { data, error } = await supabaseAdmin
    .from("field_option_catalog")
    .insert({
      field_key: input.fieldKey,
      scope: isZoppiStandard ? "zoppi_standard" : "company_custom",
      company_id: isZoppiStandard ? null : req.user!.companyId,
      value: input.value,
      label: input.label,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(withImageUrl(data));
});

fieldOptionsRouter.post("/:id/image-upload-url", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("field_option_catalog").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === "company_admin" && existing.company_id !== req.user!.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const ext = (req.body?.ext as string) ?? "jpg";
  const path = `${req.params.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("field-option-images").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});

fieldOptionsRouter.patch("/:id", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("field_option_catalog").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === "company_admin" && existing.company_id !== req.user!.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error } = await supabaseAdmin
    .from("field_option_catalog")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(withImageUrl(data));
});

fieldOptionsRouter.delete("/:id", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const { data: existing, error: fetchError } = await supabaseAdmin.from("field_option_catalog").select("*").eq("id", req.params.id).single();
  if (fetchError || !existing) return res.status(404).json({ error: "Not found" });
  if (req.user!.role === "company_admin" && existing.company_id !== req.user!.companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { error } = await supabaseAdmin.from("field_option_catalog").delete().eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});
