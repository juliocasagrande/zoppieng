import { env } from "../../env.js";
import { MercadoPagoProvider } from "./MercadoPagoProvider.js";
import { MockPaymentProvider } from "./MockPaymentProvider.js";
import type { PaymentProvider } from "./PaymentProvider.js";

export function getPaymentProvider(): PaymentProvider {
  if (env.mercadopagoAccessToken) {
    return new MercadoPagoProvider();
  }
  return new MockPaymentProvider();
}

export type { PaymentProvider, CreateSubscriptionRequest, CreateSubscriptionResult, WebhookEvent } from "./PaymentProvider.js";
