import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const bestPracticesRouter = Router();

bestPracticesRouter.get("/", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("best_practices_content").select("*").eq("active", true).order("sort_order");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

bestPracticesRouter.post("/", requireAuth, requireRole("zoppi_admin"), async (req, res) => {
  const { data, error } = await supabaseAdmin.from("best_practices_content").insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

bestPracticesRouter.patch("/:id", requireAuth, requireRole("zoppi_admin"), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("best_practices_content")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
