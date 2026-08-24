import { supabaseAdmin } from "../../lib/supabase.js";

// Human-readable sequential report number, e.g. "ZOP-2026-000123".
//
// count-then-format is not atomic: two concurrent report creations can read
// the same count and produce the same number. reports.report_number has a
// unique constraint, so instead of trusting this value we only ever use it as
// a starting guess and let the caller retry with the next one on conflict —
// see reservedReportNumbers below.
async function reportNumberCandidate(offset = 0): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabaseAdmin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01`);
  const seq = String((count ?? 0) + 1 + offset).padStart(6, "0");
  return `ZOP-${year}-${seq}`;
}

export async function nextReportNumber(offset = 0): Promise<string> {
  return reportNumberCandidate(offset);
}

export function isDuplicateReportNumberError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "23505" && !!error.message?.includes("report_number");
}
