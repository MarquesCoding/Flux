import type { WebhookAttempt, WebhookTarget } from './deliverWebhook';
import type {
  WebhookDelivery,
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
  /**
   * Files this delivery in the history, or counts another try at one already
   * there.
   *
   * Keyed on the subscription and the envelope's id together, because that
   * pair is what "this event reaching this subscriber" means. A retry is not
   * a second delivery and must not read as one.
   */
  recordDelivery: (delivery: RecordedDelivery, attempt: WebhookAttempt) => Promise<void>;
  /**
   * The most recent deliveries to one subscription, newest first.
   */
  listDeliveries: (subscriptionId: string, limit: number) => Promise<WebhookDelivery[]>;
  /**
   * The exact bytes a delivery carried, so it can be sent again unchanged.
   *
   * Null where there is no such delivery on that subscription. Scoped to the
   * subscription rather than looked up by id alone, so a delivery id lifted
   * from one subscription cannot be replayed against another.
   */
  readDeliveryBody: (subscriptionId: string, deliveryId: string) => Promise<string | null>;
  /**
   * Forgets deliveries last attempted before the given moment, reporting how
   * many went.
   */
  pruneDeliveries: (before: Date) => Promise<number>;
};

/**
 * A delivery as it is filed, before anything is known about how it went.
 *
 * `body` is the exact bytes that were signed rather than the event to encode
 * later: a redelivery that re-encodes produces a different signature from the
 * one the receiver first saw.
 */
type RecordedDelivery = {
  subscriptionId: string;
  eventId: string;
  event: WebhookEvent;
  body: string;
};

export type {
  CreatedWebhookSubscription,
  NewWebhookSubscription,
  RecordedDelivery,
  WebhookStore,
  WebhookSubscriptionChange,
};
