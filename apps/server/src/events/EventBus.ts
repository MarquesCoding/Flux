import type { WebhookPayload } from '@ValenceContracts/schemas/Webhook';

type WebhookOccurrence<TPayload = WebhookPayload> = TPayload extends WebhookPayload
  ? Omit<TPayload, 'version' | 'id' | 'occurredAt'>
  : never;

type EventBus = {
  publish: (occurrence: WebhookOccurrence) => Promise<void>;
};

export type { EventBus, WebhookOccurrence };
