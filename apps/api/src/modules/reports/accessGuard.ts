import { supabaseAdmin } from "../../lib/supabase.js";

// Spec section 7: inactive/past_due subscription blocks creating NEW reports,
// but existing report history stays readable.
export async function hasActiveModuleAccess(companyId: string, moduleId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("module_subscriptions")
    .select("status")
    .eq("company_id", companyId)
    .eq("module_id", moduleId)
    .maybeSingle();
  return data?.status === "active" || data?.status === "trialing";
}

export async function hasActiveModuleAccessBySlug(companyId: string, moduleSlug: string): Promise<boolean> {
  const { data: module } = await supabaseAdmin.from("modules").select("id").eq("slug", moduleSlug).eq("active", true).maybeSingle();
  if (!module) return false;
  return hasActiveModuleAccess(companyId, module.id);
}
