import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@zoppi/shared";
import { supabaseAdmin, supabaseAsUser } from "../lib/supabase.js";
import { withRetry } from "../lib/retry.js";

export interface AuthedUser {
  id: string;
  companyId: string | null;
  role: UserRole;
  fullName: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
      supabase?: ReturnType<typeof supabaseAsUser>;
    }
  }
}

// Verifies the Supabase Auth bearer token, loads the matching `users` row
// (role + company), and attaches both the profile and an RLS-scoped Supabase
// client to the request.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const accessToken = header.slice("Bearer ".length);

  let authData: Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["data"] | null = null;
  try {
    const result = await withRetry(async () => {
      const r = await supabaseAdmin.auth.getUser(accessToken);
      if (r.error || !r.data.user) throw r.error ?? new Error("No user");
      return r;
    });
    authData = result.data;
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  if (!authData?.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  let profile: { id: string; company_id: string | null; role: UserRole; full_name: string; email: string; active: boolean } | null = null;
  try {
    profile = await withRetry(async () => {
      const r = await supabaseAdmin.from("users").select("id, company_id, role, full_name, email, active").eq("id", authData!.user.id).maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    });
  } catch (error) {
    console.error("Unable to load platform profile", error);
    return res.status(503).json({ error: "Unable to load platform profile" });
  }
  if (!profile || !profile.active) {
    return res.status(403).json({ error: "User has no active platform profile" });
  }

  req.user = {
    id: profile.id,
    companyId: profile.company_id,
    role: profile.role,
    fullName: profile.full_name,
    email: profile.email,
  };
  req.supabase = supabaseAsUser(accessToken);
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export const isZoppiStaff = (role: UserRole) => role === "zoppi_admin" || role === "zoppi_engineer";
