import { supabaseAdmin } from "../../lib/supabase.js";

// Human-readable sequential report number, e.g. "ZOP-2026-000123".
export async function nextReportNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabaseAdmin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01`);
  const seq = String((count ?? 0) + 1).padStart(6, "0");
  return `ZOP-${year}-${seq}`;
}
