import type { WebhookAttempt, WebhookTarget } from './deliverWebhook';
import type {
  WebhookEvent,
  WebhookPreset,
  WebhookSubscription,
} from '@FluxContracts/schemas/Webhook';

/**
 * What somebody asked for when they made a subscription.
 */
type NewWebhookSubscription = {
  name: string;
  url: string;
  preset: WebhookPreset;
  events: WebhookEvent[];
};

/**
 * A subscription at the one moment its secret can be read.
 *
 * The secret is separate from the subscription rather than a field on it, so
 * that the only way to answer it to anybody is to reach for it deliberately.
 * A route returning `subscription` cannot leak it by accident.
 */
type CreatedWebhookSubscription = {
  subscription: WebhookSubscription;
  secret: string;
};

/**
 * What may be changed about a subscription after it exists.
 *
 * Not the URL, and not the events: changing where a subscription points is
 * indistinguishable, from the receiver's side, from a new subscription — and
 * a secret that was agreed with one endpoint should not silently start
 * signing deliveries to another. Making a new one is the honest version of
 * that operation.
 */
type WebhookSubscriptionChange = {
  enabled: boolean;
};

/**
 * Where subscriptions are kept.
 *
 * A port rather than the database directly, so routes and the delivery job
 * can be tested without Postgres.
 */
type WebhookStore = {
  list: () => Promise<WebhookSubscription[]>;
  create: (input: NewWebhookSubscription) => Promise<CreatedWebhookSubscription>;
  update: (id: string, change: WebhookSubscriptionChange) => Promise<WebhookSubscription | null>;
  remove: (id: string) => Promise<boolean>;
  /**
   * Which enabled subscriptions asked to hear about this event.
   *
   * Ids rather than whole rows: the delivery job reads each one again when it
   * runs, so a subscription disabled or deleted between the event and the
   * attempt is not delivered to from a copy taken beforehand.
   */
  listenersFor: (event: WebhookEvent) => Promise<string[]>;
  /**
   * Enough to deliver to one, secret included.
   *
   * The only read that returns the secret, and it exists so that nothing else
   * has to. Null where the subscription has been deleted or disabled since
   * the event was raised.
   */
  readTarget: (id: string) => Promise<WebhookTarget | null>;
  /**
   * Records how the last attempt went, so somebody can see it stopped working.
   */
  recordAttempt: (id: string, attempt: WebhookAttempt) => Promise<void>;
};

export type {
  CreatedWebhookSubscription,
  NewWebhookSubscription,
  WebhookStore,
  WebhookSubscriptionChange,
};
