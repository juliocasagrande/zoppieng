import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { hasActiveModuleAccessBySlug } from "../reports/accessGuard.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

async function signatureUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from("engineer-signatures").createSignedUrl(path, 60 * 60);
  if (error) {
    console.warn("Unable to create signed profile signature URL", error.message);
    return null;
  }
  return data.signedUrl;
}

// Returns the DB row shape (snake_case, matching the shared AppUser type) —
// not the internal camelCase AuthedUser used by middleware/route guards.
usersRouter.get("/me", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, company_id, role, full_name, email, phone, crea_number, active")
    .eq("id", req.user!.id)
    .maybeSingle();
  if (error) {
    console.error("Unable to load user profile", error);
    return res.status(503).json({ error: "Unable to load user profile" });
  }
  if (!data) return res.status(404).json({ error: "Profile not found" });

  // `signature_path` was introduced after the core profile. Loading it
  // separately keeps login working while an older production database is
  // waiting for migration 0014 to be applied.
  const signatureResult = await supabaseAdmin
    .from("users")
    .select("signature_path")
    .eq("id", req.user!.id)
    .maybeSingle();
  const signaturePath = signatureResult.error ? null : signatureResult.data?.signature_path ?? null;
  if (signatureResult.error) {
    console.warn("Unable to load optional profile signature", signatureResult.error.message);
  }

  const isZoppiStaff = data.role === "zoppi_admin" || data.role === "zoppi_engineer";
  const canCreateReports = isZoppiStaff || (data.company_id ? await hasActiveModuleAccessBySlug(data.company_id, "ancoragem") : false);
  res.json({
    ...data,
    signature_path: signaturePath,
    can_create_reports: canCreateReports,
    signature_url: await signatureUrl(signaturePath),
  });
});

// Returns a signed upload URL for the caller's own signature image (white
// background, as if signed on paper) — used alongside the ICP-Brasil digital
// certificate and ART in the PDF signature block, not instead of them.
usersRouter.post("/me/signature-upload-url", async (req, res) => {
  const ext = (req.body?.ext as string) ?? "png";
  const path = `${req.user!.id}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from("engineer-signatures").createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ path, token: data.token, signedUrl: data.signedUrl });
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

// Fields a caller may ever set via this endpoint, keyed by who's allowed to
// set them. Never spread req.body directly into the update — role/company_id/
// active are privilege-bearing columns.
const SELF_EDITABLE_FIELDS = ["full_name", "phone"] as const;
const ADMIN_EDITABLE_FIELDS = ["full_name", "phone", "crea_number", "active", "role", "company_id"] as const;
const COMPANY_ADMIN_EDITABLE_FIELDS = ["full_name", "phone", "active", "role"] as const;

function pick<T extends string>(body: Record<string, unknown>, fields: readonly T[]): Partial<Record<T, unknown>> {
  const result: Partial<Record<T, unknown>> = {};
  for (const field of fields) {
    if (field in body) result[field] = body[field];
  }
  return result;
}

usersRouter.patch("/:id", async (req, res) => {
  const target = req.params.id;
  const isSelf = target === req.user!.id;

  const { data: targetUser, error: targetError } = await supabaseAdmin
    .from("users")
    .select("id, company_id, role")
    .eq("id", target)
    .single();
  if (targetError || !targetUser) return res.status(404).json({ error: "User not found" });

  let patch: Partial<Record<string, unknown>>;
  if (req.user!.role === "zoppi_admin") {
    patch = pick(req.body, ADMIN_EDITABLE_FIELDS);
  } else if (req.user!.role === "company_admin" && req.user!.companyId && targetUser.company_id === req.user!.companyId) {
    // Company admins may only promote/demote within their own company's roles.
    patch = pick(req.body, COMPANY_ADMIN_EDITABLE_FIELDS);
    if (patch.role !== undefined && patch.role !== "company_admin" && patch.role !== "company_operational") {
      return res.status(403).json({ error: "Company admins can only assign company roles" });
    }
    delete patch.company_id;
  } else if (isSelf) {
    patch = pick(req.body, SELF_EDITABLE_FIELDS);
  } else {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", target)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
