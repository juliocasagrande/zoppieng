import { env } from "../../env.js";
import type { NotificationChannelProvider, SendMessageRequest, SendMessageResult } from "./NotificationProvider.js";

// Sends via Resend when RESEND_API_KEY is set; otherwise logs only, so the
// notification pipeline (jobs, notifications_log) is fully exercisable in dev.
export class EmailProvider implements NotificationChannelProvider {
  async send(request: SendMessageRequest): Promise<SendMessageResult> {
    if (!env.resendApiKey) {
      console.log(`[EmailProvider:mock] to=${request.to} subject=${request.subject}\n${request.body}`);
      return { status: "sent", providerReference: "log-only" };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [request.to],
        subject: request.subject ?? "Zoppi",
        html: request.body,
      }),
    });

    if (!response.ok) {
      return { status: "failed", providerReference: null, error: await response.text() };
    }
    const data = (await response.json()) as { id: string };
    return { status: "sent", providerReference: data.id };
  }
}
