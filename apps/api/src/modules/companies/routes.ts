import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const companiesRouter = Router();

companiesRouter.use(requireAuth);

function withLogoUrl<T extends { logo_path: string | null }>(item: T): T & { logo_url: string | null } {
  const logo_url = item.logo_path ? supabaseAdmin.storage.from("company-logos").getPublicUrl(item.logo_path).data.publicUrl : null;
  return { ...item, logo_url };
}

companiesRouter.get("/", requireRole("zoppi_admin", "zoppi_engineer"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("companies").select("*").order("legal_name");
  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(withLogoUrl));
});

companiesRouter.get("/:id", async (req, res) => {
  if (req.user!.role === "company_admin" || req.user!.role === "company_operational") {
    if (req.user!.companyId !== req.params.id) return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error } = await supabaseAdmin.from("companies").select("*").eq("id", req.params.id).single();
  if (error) return res.status(404).json({ error: "Company not found" });
  res.json(withLogoUrl(data));
});

companiesRouter.post("/", requireRole("zoppi_admin"), async (req, res) => {
  const { data, error } = await supabaseAdmin.from("companies").insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(withLogoUrl(data));
});

companiesRouter.patch("/:id", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  if (req.user!.role === "company_admin" && req.user!.companyId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error } = await supabaseAdmin
    .from("companies")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(withLogoUrl(data));
});

// Returns a signed upload URL for the company's PDF logo; the client uploads
// directly to Supabase Storage, then PATCHes { logo_path: path } to attach it
// (same pattern as accessory-catalog images — see accessories/routes.ts).
companiesRouter.post("/:id/logo-upload-url", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  if (req.user!.role === "company_admin" && req.user!.companyId !== req.params.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const ext = (req.body?.ext as string) ?? "png";
  const path = `${req.params.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("company-logos").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
});
