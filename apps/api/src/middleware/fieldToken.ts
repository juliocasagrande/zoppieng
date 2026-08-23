import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../env.js";
import { supabaseAdmin } from "../lib/supabase.js";

export interface FieldTokenPayload {
  linkId: string;
  reportId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      fieldLink?: { id: string; reportId: string };
    }
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signFieldToken(payload: FieldTokenPayload, expiresInDays: number): string {
  return jwt.sign(payload, env.fieldTokenSecret, { expiresIn: `${expiresInDays}d` });
}

// Validates the field-flow JWT AND cross-checks it against report_field_links
// so a link can be independently revoked/expired/marked used server-side,
// even before the JWT's own expiry.
export async function requireFieldToken(req: Request, res: Response, next: NextFunction) {
  const token = req.params.token ?? (req.body as { token?: string })?.token;
  if (!token) {
    return res.status(400).json({ error: "Missing field token" });
  }

  let payload: FieldTokenPayload;
  try {
    payload = jwt.verify(token, env.fieldTokenSecret) as FieldTokenPayload;
  } catch {
    return res.status(401).json({ error: "Link inválido ou expirado" });
  }

  const { data: link, error } = await supabaseAdmin
    .from("report_field_links")
    .select("id, report_id, status, expires_at")
    .eq("id", payload.linkId)
    .eq("token_hash", hashToken(token))
    .single();

  if (error || !link) {
    return res.status(401).json({ error: "Link inválido" });
  }
  if (link.status !== "pending") {
    return res.status(410).json({ error: "Este link já foi usado ou revogado" });
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("report_field_links").update({ status: "expired" }).eq("id", link.id);
    return res.status(410).json({ error: "Este link expirou" });
  }

  req.fieldLink = { id: link.id, reportId: link.report_id };
  next();
}
