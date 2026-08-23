export interface CreateSubscriptionRequest {
  companyId: string;
  moduleId: string;
  planCode: string;
  monthlyAmountCents: number;
  payerEmail: string;
}

export interface CreateSubscriptionResult {
  providerSubscriptionId: string;
  checkoutUrl: string | null;
}

export interface WebhookEvent {
  providerSubscriptionId: string;
  status: "active" | "past_due" | "cancelled";
  raw: unknown;
}

// Abstraction over the recurring-billing gateway (Mercado Pago today).
// module_subscriptions is only ever written through this interface + the
// webhook handler, so swapping gateways later doesn't touch billing routes.
export interface PaymentProvider {
  createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  parseWebhook(rawBody: unknown, headers: Record<string, string | string[] | undefined>): WebhookEvent | null;
}
