import { z } from 'zod';

const WEBHOOK_EVENTS = [
  'webhook.test',
  'job.completed',
  'job.failed',
  'job.stalled',
  'job.working',
  'library.scanned',
  'catalogue.unreachable',
  'catalogue.reachable',
  'transcoder.unreachable',
  'transcoder.reachable',
  'disk.low',
  'disk.recovered',
] as const;

const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'webhook.test': 'A test, sent by hand',
  'job.completed': 'A background job finished',
  'job.failed': 'A background job failed',
  'job.stalled': 'A kind of job fails every time it runs',
  'job.working': 'A kind of job that was failing every time now works',
  'library.scanned': 'A library finished scanning',
  'catalogue.unreachable': 'The catalogue could not be reached',
  'catalogue.reachable': 'The catalogue can be reached again',
  'transcoder.unreachable': 'The transcoder could not be reached',
  'transcoder.reachable': 'The transcoder is answering again',
  'disk.low': 'A disk is running out of room',
  'disk.recovered': 'A disk has room again',
};

const WEBHOOK_PAYLOAD_VERSION = 1;

const WebhookEnvelopeSchema = {
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
};

const WebhookJobDataSchema = z.object({
  kind: z.string(),
  jobId: z.string(),
  subject: z.string().nullable(),
});

const DiskRoomSchema = z.object({
  mountPoint: z.string(),
  totalBytes: z.number().nonnegative(),
  availableBytes: z.number().nonnegative(),
});

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
    event: z.literal('job.stalled'),
    data: z.object({
      kind: z.string(),
      label: z.string(),
      failures: z.number().int().positive(),
      everSucceeded: z.boolean(),
      reason: z.string(),
    }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('job.working'),
    data: z.object({ kind: z.string(), label: z.string() }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('library.scanned'),
    data: z.object({
      libraryId: z.string().uuid(),
      libraryName: z.string(),
      added: z.number().int().nonnegative(),
      updated: z.number().int().nonnegative(),
      removed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('catalogue.unreachable'),
    data: z.object({}),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('catalogue.reachable'),
    data: z.object({}),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('transcoder.unreachable'),
    data: z.object({ reason: z.string() }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('transcoder.reachable'),
    data: z.object({}),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('disk.low'),
    data: DiskRoomSchema,
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('disk.recovered'),
    data: DiskRoomSchema,
  }),
]);

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

const WEBHOOK_PRESETS = ['generic', 'discord', 'ntfy'] as const;

const WebhookPresetSchema = z.enum(WEBHOOK_PRESETS);

type WebhookPreset = (typeof WEBHOOK_PRESETS)[number];

const WebhookDeliveryResultSchema = z.object({
  lastAttemptAt: z.string().datetime().nullable(),
  lastStatus: z.number().int().nullable(),
  lastError: z.string().nullable(),
});

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
