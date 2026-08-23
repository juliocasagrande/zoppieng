export interface SendMessageRequest {
  to: string;
  subject?: string;
  body: string;
}

export interface SendMessageResult {
  status: "sent" | "failed";
  providerReference: string | null;
  error?: string;
}

export interface NotificationChannelProvider {
  send(request: SendMessageRequest): Promise<SendMessageResult>;
}
