import crypto from "node:crypto";
import { env } from "../../env.js";
import type {
  CreateSubscriptionRequest,
  CreateSubscriptionResult,
  PaymentProvider,
  WebhookEvent,
} from "./PaymentProvider.js";

const MP_API_BASE = "https://api.mercadopago.com";

// Recurring billing via Mercado Pago "preapproval" (assinatura). Real API
// calls — only exercised when MERCADOPAGO_ACCESS_TOKEN is configured.
export class MercadoPagoProvider implements PaymentProvider {
  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResult> {
    const response = await fetch(`${MP_API_BASE}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.mercadopagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: `Zoppi — assinatura módulo ${request.moduleId}`,
        external_reference: `${request.companyId}:${request.moduleId}`,
        payer_email: request.payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: request.monthlyAmountCents / 100,
          currency_id: "BRL",
        },
        back_url: env.webAppBaseUrl,
        status: "pending",
      }),
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago createSubscription failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { id: string; init_point?: string };
    return { providerSubscriptionId: data.id, checkoutUrl: data.init_point ?? null };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    const response = await fetch(`${MP_API_BASE}/preapproval/${providerSubscriptionId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.mercadopagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!response.ok) {
      throw new Error(`Mercado Pago cancelSubscription failed: ${response.status} ${await response.text()}`);
    }
  }

  async getSubscriptionStatus(providerSubscriptionId: string): Promise<WebhookEvent["status"] | null> {
    const response = await fetch(`${MP_API_BASE}/preapproval/${providerSubscriptionId}`, {
      headers: {
        Authorization: `Bearer ${env.mercadopagoAccessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Mercado Pago getSubscriptionStatus failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { status?: string };
    if (data.status === "authorized") return "active";
    if (data.status === "paused") return "past_due";
    if (data.status === "cancelled") return "cancelled";
    return null;
  }

  // Verifies Mercado Pago's HMAC webhook signature (x-signature / x-request-id
  // headers) before trusting the payload — otherwise anyone could POST an
  // arbitrary subscription id to this public, unauthenticated endpoint.
  // https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
  parseWebhook(
    rawBody: unknown,
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, unknown>,
  ): WebhookEvent | null {
    const body = rawBody as { data?: { id?: string }; action?: string; type?: string } | undefined;
    if (!body?.data?.id) return null;
    if (!env.mercadopagoWebhookSecret) {
      console.error("[MercadoPagoProvider] MERCADOPAGO_WEBHOOK_SECRET is not configured; rejecting webhook.");
      return null;
    }

    const signatureHeader = headers["x-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) return null;

    const parts: Record<string, string> = {};
    for (const piece of signature.split(",")) {
      const [key, value] = piece.split("=");
      if (key && value) parts[key.trim()] = value.trim();
    }
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return null;

    const requestIdHeader = headers["x-request-id"];
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
    const dataId = (query["data.id"] as string | undefined) ?? body.data.id;

    const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
    const expected = crypto.createHmac("sha256", env.mercadopagoWebhookSecret).update(manifest).digest("hex");

    const expectedBuf = Buffer.from(expected, "hex");
    const gotBuf = Buffer.from(v1, "hex");
    if (expectedBuf.length !== gotBuf.length || !crypto.timingSafeEqual(expectedBuf, gotBuf)) {
      console.warn("[MercadoPagoProvider] webhook signature mismatch — rejecting.");
      return null;
    }

    // The webhook only identifies the subscription. The route fetches the
    // authoritative provider status before changing local access.
    return { providerSubscriptionId: body.data.id, status: "active", raw: rawBody };
  }
}
