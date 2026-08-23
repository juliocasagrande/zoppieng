import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// Returns the DB row shape (snake_case, matching the shared AppUser type) —
// not the internal camelCase AuthedUser used by middleware/route guards.
usersRouter.get("/me", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, company_id, role, full_name, email, phone, crea_number, active")
    .eq("id", req.user!.id)
    .single();
  if (error || !data) return res.status(404).json({ error: "Profile not found" });
  res.json(data);
});

usersRouter.get("/", async (req, res) => {
  const { role, companyId } = req.user!;
  let query = supabaseAdmin.from("users").select("id, company_id, role, full_name, email, phone, crea_number, active");
  if (role === "company_admin" || role === "company_operational") {
    query = query.eq("company_id", companyId);
  } else if (role === "zoppi_engineer") {
    query = query.eq("role", "zoppi_engineer");
  }
  const { data, error } = await query.order("full_name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Creates the `users` profile row for an already-created auth.users account
// (the auth account itself is created via Supabase Auth admin API / invite).
usersRouter.post("/", requireRole("zoppi_admin", "company_admin"), async (req, res) => {
  const body = req.body as { authUserId: string; companyId?: string; role: string; fullName: string; email: string; phone?: string; creaNumber?: string };

  if (req.user!.role === "company_admin") {
    if (body.role !== "company_admin" && body.role !== "company_operational") {
      return res.status(403).json({ error: "Company admins can only create company users" });
    }
    body.companyId = req.user!.companyId ?? undefined;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      id: body.authUserId,
      company_id: body.companyId ?? null,
      role: body.role,
      full_name: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      crea_number: body.creaNumber ?? null,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

usersRouter.patch("/:id", async (req, res) => {
  const target = req.params.id;
  const isSelf = target === req.user!.id;
  const isCompanyAdminOfSameCompany = req.user!.role === "company_admin";
  if (!isSelf && req.user!.role !== "zoppi_admin" && !isCompanyAdminOfSameCompany) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", target)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
