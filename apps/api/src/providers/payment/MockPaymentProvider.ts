import crypto from "node:crypto";
import type {
  CreateSubscriptionRequest,
  CreateSubscriptionResult,
  PaymentProvider,
  WebhookEvent,
} from "./PaymentProvider.js";

// Used whenever MERCADOPAGO_ACCESS_TOKEN is not set. Logs to the console
// instead of calling the real API, and always "succeeds" so the rest of the
// billing flow can be exercised end-to-end in dev.
export class MockPaymentProvider implements PaymentProvider {
  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResult> {
    const id = `mock-sub-${crypto.randomUUID()}`;
    console.log(`[MockPaymentProvider] created subscription ${id}`, request);
    return { providerSubscriptionId: id, checkoutUrl: null };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    console.log(`[MockPaymentProvider] cancelled subscription ${providerSubscriptionId}`);
  }

  parseWebhook(): WebhookEvent | null {
    return null;
  }
}
