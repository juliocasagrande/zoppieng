import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const companiesRouter = Router();

companiesRouter.use(requireAuth);

companiesRouter.get("/", requireRole("zoppi_admin", "zoppi_engineer"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("companies").select("*").order("legal_name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

companiesRouter.get("/:id", async (req, res) => {
  if (req.user!.role === "company_admin" || req.user!.role === "company_operational") {
    if (req.user!.companyId !== req.params.id) return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error } = await supabaseAdmin.from("companies").select("*").eq("id", req.params.id).single();
  if (error) return res.status(404).json({ error: "Company not found" });
  res.json(data);
});

companiesRouter.post("/", requireRole("zoppi_admin"), async (req, res) => {
  const { data, error } = await supabaseAdmin.from("companies").insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
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
  res.json(data);
});
