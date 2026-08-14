import { z } from 'zod';

/**
 * Every event Flux will deliver to a subscriber.
 *
 * Deliberately short. A payload shape is a public interface — once somebody
 * has built a script against `job.failed`, renaming it or moving a field
 * breaks them silently, at three in the morning, in the one system that was
 * supposed to tell them things had broken. A dozen events that never change
 * are worth more than forty that get corrected.
 *
 * Every entry here is something the server can already detect. Events for
 * things Flux cannot yet observe are not listed as coming soon: an event
 * nothing raises is indistinguishable, to a subscriber, from one that is
 * broken.
 *
 * The household half of notifications — new episodes, a download ready, a
 * watch party invitation — is deliberately absent. Those want in-app and push
 * delivery rather than a webhook, and the noisiest of them needs batching
 * before it is fit to send at all: a scan importing four hundred files must
 * not send four hundred messages.
 */
const WEBHOOK_EVENTS = [
  'webhook.test',
  'job.completed',
  'job.failed',
  'catalogue.unreachable',
  'transcoder.unreachable',
] as const;

const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * What each event is called where an operator chooses which to subscribe to.
 *
 * A complete record rather than a derived one, so adding an event to the
 * catalogue fails to compile here until somebody says what it is called. An
 * event appearing in a subscription form unnamed would be worse than being
 * made to name it.
 */
const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'webhook.test': 'A test, sent by hand',
  'job.completed': 'A background job finished',
  'job.failed': 'A background job failed',
  'catalogue.unreachable': 'The catalogue could not be reached',
  'transcoder.unreachable': 'The transcoder could not be reached',
};

/**
 * The shape of the envelope, stated in the envelope.
 *
 * Present from the first delivery rather than added once a change is needed:
 * a receiver written against version one can refuse an envelope it does not
 * recognise, which is only possible if there was a version to compare against
 * from the beginning.
 */
const WEBHOOK_PAYLOAD_VERSION = 1;

/**
 * What is true of every delivery, whatever it is about.
 *
 * `id` names the occurrence rather than the attempt. A delivery that is
 * retried carries the same id each time, so a receiver can recognise the
 * second attempt as the same event rather than acting on it twice.
 */
const WebhookEnvelopeSchema = {
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
};

/**
 * What is known about a background job, whether it finished or failed.
 *
 * `subject` is what the work was about — a library id, for everything that
 * runs against one — so a receiver can say which library rather than only
 * which kind of job.
 */
const WebhookJobDataSchema = z.object({
  kind: z.string(),
  jobId: z.string(),
  subject: z.string().nullable(),
});

/**
 * A delivery, as a receiver reads it.
 *
 * Discriminated on `event`, so the data carried by each is typed to that
 * event rather than being one loose bag of optional fields that every
 * receiver has to guess its way through.
 */
const WebhookPayloadSchema = z.discriminatedUnion('event', [
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('webhook.test'),
    data: z.object({}),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('job.completed'),
    data: WebhookJobDataSchema,
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('job.failed'),
    data: WebhookJobDataSchema.extend({ reason: z.string() }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('catalogue.unreachable'),
    data: z.object({}),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('transcoder.unreachable'),
    data: z.object({ reason: z.string() }),
  }),
]);

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

/**
 * The shape a subscriber expects a request to arrive in.
 *
 * A preset is a body shape and nothing more — the same event, the same
 * delivery, the same retries, written the way a particular receiver reads.
 * `generic` is Flux's own envelope, which is the one to build against; the
 * other two exist because between them Discord and ntfy cover most of the
 * people who will ever set one of these up, and neither can be asked to
 * understand an envelope.
 */
const WEBHOOK_PRESETS = ['generic', 'discord', 'ntfy'] as const;

const WebhookPresetSchema = z.enum(WEBHOOK_PRESETS);

type WebhookPreset = (typeof WEBHOOK_PRESETS)[number];

/**
 * How a delivery went, as far as the subscription is concerned.
 *
 * Held against the subscription rather than as a log of every attempt,
 * because the question an operator has is "is this still working", not "what
 * happened on the fourteenth". A webhook that quietly stopped working is
 * worse than no webhook at all, and this is the only way anybody notices.
 *
 * `lastStatus` is what the receiver answered with, and is null where nothing
 * answered at all — a refused connection, a name that does not resolve, a
 * timeout.
 */
const WebhookDeliveryResultSchema = z.object({
  lastAttemptAt: z.string().datetime().nullable(),
  lastStatus: z.number().int().nullable(),
  lastError: z.string().nullable(),
});

/**
 * A subscription, as it can safely be read back.
 *
 * The signing secret is absent by design, the same as an API key's key: it is
 * shown once when the subscription is made and never again, because a list
 * endpoint that returns every secret is one stolen session away from letting
 * somebody forge deliveries.
 */
const WebhookSubscriptionSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    url: z.string().url(),
    preset: WebhookPresetSchema,
    events: z.array(WebhookEventSchema).min(1),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .merge(WebhookDeliveryResultSchema);

type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

/**
 * One event's journey to one subscriber, however many tries it took.
 *
 * A row per delivery rather than per attempt, because the envelope's `id` is
 * the occurrence rather than the attempt: a retry is the same event reaching
 * the same subscriber, and recording it twice would say a receiver failed
 * twice when it failed once and was asked again.
 *
 * `attempts` is what makes that visible without a row each. A delivery that
 * reads `attempts: 3, ok: true` is a receiver that was briefly down, which is
 * a different fact from three separate deliveries that each failed once.
 *
 * The stored body is the exact bytes that were signed. A redelivery has to
 * send those rather than re-encoding the event, or the signature differs from
 * the one the receiver first saw — and the envelope's `id` exists precisely
 * so a receiver can recognise the second arrival as the first event rather
 * than acting on it twice.
 */
const WebhookDeliverySchema = z.object({
  id: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  event: WebhookEventSchema,
  attempts: z.number().int().positive(),
  firstAttemptAt: z.string().datetime(),
  lastAttemptAt: z.string().datetime(),
  ok: z.boolean(),
  status: z.number().int().nullable(),
  error: z.string().nullable(),
});

type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

type WebhookDeliveryResult = z.infer<typeof WebhookDeliveryResultSchema>;

export {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_PAYLOAD_VERSION,
  WEBHOOK_PRESETS,
  WebhookDeliveryResultSchema,
  WebhookDeliverySchema,
  WebhookEventSchema,
  WebhookJobDataSchema,
  WebhookPayloadSchema,
  WebhookPresetSchema,
  WebhookSubscriptionSchema,
};

export type {
  WebhookDelivery,
  WebhookDeliveryResult,
  WebhookEvent,
  WebhookPayload,
  WebhookPreset,
  WebhookSubscription,
};
