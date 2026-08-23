import { env } from "../../env.js";
import type { NotificationChannelProvider, SendMessageRequest, SendMessageResult } from "./NotificationProvider.js";

// Stub: no WhatsApp Business/Twilio/Z-API provider chosen yet (spec section
// 13). Logs the outgoing message and records it as "sent" so downstream
// status tracking behaves the same once a real provider is wired in.
export class WhatsAppProvider implements NotificationChannelProvider {
  async send(request: SendMessageRequest): Promise<SendMessageResult> {
    if (!env.whatsappProviderApiKey) {
      console.log(`[WhatsAppProvider:mock] to=${request.to}\n${request.body}`);
      return { status: "sent", providerReference: "log-only" };
    }
    // TODO: integrate real provider (WhatsApp Business API, Twilio, Z-API) once chosen.
    console.log(`[WhatsAppProvider:unconfigured-key] to=${request.to}\n${request.body}`);
    return { status: "sent", providerReference: "log-only" };
  }
}
