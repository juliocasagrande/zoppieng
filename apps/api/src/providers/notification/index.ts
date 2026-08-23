import type { NotificationChannel } from "@zoppi/shared";
import { EmailProvider } from "./EmailProvider.js";
import { WhatsAppProvider } from "./WhatsAppProvider.js";
import type { NotificationChannelProvider } from "./NotificationProvider.js";

const providers: Record<NotificationChannel, NotificationChannelProvider> = {
  email: new EmailProvider(),
  whatsapp: new WhatsAppProvider(),
};

export function getNotificationProvider(channel: NotificationChannel): NotificationChannelProvider {
  return providers[channel];
}

export type { NotificationChannelProvider, SendMessageRequest, SendMessageResult } from "./NotificationProvider.js";
