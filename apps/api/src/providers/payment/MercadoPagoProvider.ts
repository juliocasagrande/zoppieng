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

  parseWebhook(rawBody: unknown): WebhookEvent | null {
    const body = rawBody as { data?: { id?: string }; action?: string; type?: string } | undefined;
    if (!body?.data?.id) return null;
    // The webhook only identifies the subscription. The route fetches the
    // authoritative provider status before changing local access.
    return { providerSubscriptionId: body.data.id, status: "active", raw: rawBody };
  }
}
