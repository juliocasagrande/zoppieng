import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";

export const registrationRouter = Router();

const registerSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  companyLegalName: z.string().min(1),
  companyCnpj: z.string().min(1),
});

// Public self-registration for a new subscriber company (spec section 3.1,
// "dona do imóvel/instalação" case: a company subscribing directly for its
// own reports). Creates the Supabase Auth user, the company row, and the
// company_admin profile in one shot — RLS has no insert policy for
// self-service signup, so this runs through the service role key instead.
registrationRouter.post("/", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  const { data: existingCompany } = await supabaseAdmin.from("companies").select("id").eq("cnpj", input.companyCnpj).maybeSingle();
  if (existingCompany) {
    return res.status(409).json({ error: "Já existe uma empresa cadastrada com este CNPJ." });
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    const status = authError?.status === 422 ? 409 : 400;
    return res.status(status).json({ error: authError?.message ?? "Não foi possível criar a conta." });
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .insert({ legal_name: input.companyLegalName, cnpj: input.companyCnpj, kind: "facility_owner", contact_email: input.email, contact_name: input.fullName })
    .select()
    .single();
  if (companyError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return res.status(400).json({ error: companyError.message });
  }

  const { error: profileError } = await supabaseAdmin.from("users").insert({
    id: authUser.user.id,
    company_id: company.id,
    role: "company_admin",
    full_name: input.fullName,
    email: input.email,
  });
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    await supabaseAdmin.from("companies").delete().eq("id", company.id);
    return res.status(400).json({ error: profileError.message });
  }

  res.status(201).json({ ok: true });
});
