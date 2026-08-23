import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabase.js";

// Public, unauthenticated verification endpoint — the target of the QR code
// printed on the signed PDF (spec section 4.9).
export const verifyRouter = Router();

verifyRouter.get("/:reportId", async (req, res) => {
  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("id, name, report_number, status, issued_at, valid_until, companies(legal_name)")
    .eq("id", req.params.reportId)
    .single();
  if (error || !report || !["signed", "delivered"].includes(report.status)) {
    return res.status(404).json({ valid: false });
  }
  const { data: signature } = await supabaseAdmin
    .from("signatures")
    .select("engineer_id, signed_at, document_hash, users(full_name, crea_number)")
    .eq("report_id", report.id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  res.json({
    valid: true,
    report: {
      name: report.name,
      reportNumber: report.report_number,
      issuedAt: report.issued_at,
      validUntil: report.valid_until,
      company: (report as any).companies?.legal_name,
    },
    signature: signature
      ? {
          engineerName: (signature as any).users?.full_name,
          engineerCrea: (signature as any).users?.crea_number,
          signedAt: signature.signed_at,
        }
      : null,
  });
});
