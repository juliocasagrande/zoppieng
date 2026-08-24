import "dotenv/config";

// Local-dev-only escape hatch for corporate SSL-inspection proxies (e.g.
// Forcepoint) that route every HTTPS connection through a rotating fleet of
// inspection nodes, each minting its own intermediate cert that's never
// included in the handshake — Node can't build a trust chain to it no matter
// how many times we retry. Never applies outside development, and only when
// explicitly opted in — this must never reach production, where no such
// proxy exists and full TLS verification stays on.
if (process.env.NODE_ENV !== "production" && process.env.DEV_INSECURE_TLS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("[dev] DEV_INSECURE_TLS=true — TLS certificate verification is DISABLED for this process (local dev only).");
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  // Railway (and most PaaS) inject PORT and expect the app to bind to it;
  // API_PORT stays as the local-dev override.
  apiPort: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4000",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  fieldTokenSecret: process.env.FIELD_TOKEN_SECRET ?? "dev-only-insecure-secret",
  fieldTokenDefaultExpiryDays: Number(process.env.FIELD_TOKEN_DEFAULT_EXPIRY_DAYS ?? 7),

  reportDefaultValidityMonths: Number(process.env.REPORT_DEFAULT_VALIDITY_MONTHS ?? 12),

  mercadopagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
  mercadopagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",

  signatureProvider: process.env.SIGNATURE_PROVIDER ?? "mock",
  signatureProviderApiKey: process.env.SIGNATURE_PROVIDER_API_KEY ?? "",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "laudos@zoppi.com.br",

  whatsappProviderApiKey: process.env.WHATSAPP_PROVIDER_API_KEY ?? "",

  webAppBaseUrl: process.env.WEB_APP_BASE_URL ?? "http://localhost:5173",
};

export function assertSupabaseConfigured() {
  required("SUPABASE_URL", env.supabaseUrl || undefined);
  required("SUPABASE_SERVICE_ROLE_KEY", env.supabaseServiceRoleKey || undefined);
}

// The "dev-only-insecure-secret" fallback above must never be reachable in
// production — it's a publicly-known string, so anyone could forge a valid
// field-access JWT for any report if it were ever used to sign one for real.
if (process.env.NODE_ENV === "production" && env.fieldTokenSecret === "dev-only-insecure-secret") {
  throw new Error("Missing required environment variable: FIELD_TOKEN_SECRET");
}
