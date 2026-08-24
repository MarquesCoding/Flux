import type { WebhookAttempt, WebhookTarget } from './deliverWebhook';
import type { WebhookOccurrence } from '@ValenceServer/events/EventBus';
import type {
  WebhookDelivery,
  WebhookEvent,
  WebhookFilters,
  WebhookPreset,
  WebhookSubscription,
} from '@ValenceContracts/schemas/Webhook';

type NewWebhookSubscription = {
  name: string;
  url: string;
  preset: WebhookPreset;
  events: WebhookEvent[];
  filters?: WebhookFilters;
};

type CreatedWebhookSubscription = {
  subscription: WebhookSubscription;
  secret: string;
};

type WebhookSubscriptionChange = {
  name?: string | undefined;
  url?: string | undefined;
  preset?: WebhookPreset | undefined;
  events?: WebhookEvent[] | undefined;
  filters?: WebhookFilters | undefined;
  enabled?: boolean | undefined;
};

type WebhookStore = {
  list: () => Promise<WebhookSubscription[]>;
  create: (input: NewWebhookSubscription) => Promise<CreatedWebhookSubscription>;
  update: (id: string, change: WebhookSubscriptionChange) => Promise<WebhookSubscription | null>;
  remove: (id: string) => Promise<boolean>;
  listenersFor: (occurrence: WebhookOccurrence) => Promise<string[]>;
  readTarget: (id: string) => Promise<WebhookTarget | null>;
  recordAttempt: (id: string, attempt: WebhookAttempt) => Promise<void>;
  recordDelivery: (delivery: RecordedDelivery, attempt: WebhookAttempt) => Promise<void>;
  listDeliveries: (subscriptionId: string, limit: number) => Promise<WebhookDelivery[]>;
  readDeliveryBody: (subscriptionId: string, deliveryId: string) => Promise<string | null>;
  pruneDeliveries: (before: Date) => Promise<number>;
};

type RecordedDelivery = {
  subscriptionId: string;
  eventId: string;
  event: WebhookEvent;
  body: string;
};

export type { WebhookStore };
