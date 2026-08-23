import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  apiPort: Number(process.env.API_PORT ?? 4000),
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
