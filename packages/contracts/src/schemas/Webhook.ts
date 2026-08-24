import { z } from 'zod';
import { MediaKindSchema } from './MediaKind';
import { PLAYBACK_MODES } from '@ValenceContracts/functions/describePlaybackMode';

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
  'auth.succeeded',
  'auth.failed',
  'account.created',
  'account.deleted',
  'account.roleChanged',
  'media.added',
  'media.removed',
  'playback.started',
  'playback.stopped',
] as const;

const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const WebhookSubscribableEventSchema = WebhookEventSchema.exclude(['webhook.test']);

const WEBHOOK_SUBSCRIBABLE_EVENTS = WebhookSubscribableEventSchema.options;

type WebhookSubscribableEvent = z.infer<typeof WebhookSubscribableEventSchema>;

/**
 * Whether an event is one somebody can subscribe to, as opposed to one Valence only ever sends by
 * itself. A subscription stored before an event stopped being offered still holds it, so anything
 * reading one back has to be able to tell.
 *
 * @param event - The event to judge.
 * @returns Whether a subscription may ask for it.
 */
const isSubscribableEvent = (event: WebhookEvent): event is WebhookSubscribableEvent =>
  WebhookSubscribableEventSchema.safeParse(event).success;

const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'webhook.test': 'Test delivery',
  'job.completed': 'Job finished',
  'job.failed': 'Job failed',
  'job.stalled': 'Job failing every time',
  'job.working': 'Job working again',
  'library.scanned': 'Library scanned',
  'catalogue.unreachable': 'Catalogue unreachable',
  'catalogue.reachable': 'Catalogue reachable',
  'transcoder.unreachable': 'Transcoder unreachable',
  'transcoder.reachable': 'Transcoder answering',
  'disk.low': 'Disk low on room',
  'disk.recovered': 'Disk has room',
  'auth.succeeded': 'Signed in',
  'auth.failed': 'Sign-in refused',
  'account.created': 'Account made',
  'account.deleted': 'Account deleted',
  'account.roleChanged': 'Role changed',
  'media.added': 'Something arrived',
  'media.removed': 'Something left',
  'playback.started': 'Started watching',
  'playback.stopped': 'Stopped watching',
};

const WEBHOOK_EVENT_NOTES: Partial<Record<WebhookEvent, string>> = {
  'auth.failed': 'Rate-limited attempts are refused before Valence sees them.',
  'playback.started': 'Names the person and what they are watching.',
  'playback.stopped': 'Names the person and what they were watching.',
};

type WebhookEventGroup = {
  id: string;
  label: string;
  events: readonly WebhookSubscribableEvent[];
};

const WEBHOOK_EVENT_GROUPS: readonly WebhookEventGroup[] = [
  {
    id: 'server',
    label: 'The server',
    events: [
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
    ],
  },
  {
    id: 'people',
    label: 'People',
    events: [
      'auth.succeeded',
      'auth.failed',
      'account.created',
      'account.deleted',
      'account.roleChanged',
    ],
  },
  {
    id: 'library',
    label: 'The library',
    events: ['media.added', 'media.removed'],
  },
  {
    id: 'watching',
    label: 'Watching',
    events: ['playback.started', 'playback.stopped'],
  },
];

const WEBHOOK_PAYLOAD_VERSION = 1;

const MEDIA_ADDED_GRANULARITIES = ['perItem', 'perScan'] as const;

const MediaAddedGranularitySchema = z.enum(MEDIA_ADDED_GRANULARITIES);

type MediaAddedGranularity = (typeof MEDIA_ADDED_GRANULARITIES)[number];

const WebhookFiltersSchema = z.object({
  mediaAdded: MediaAddedGranularitySchema.default('perScan'),
  accounts: z.array(z.string()).default([]),
  profiles: z.array(z.string()).default([]),
  itemTypes: z.array(MediaKindSchema).default([]),
});

type WebhookFilters = z.infer<typeof WebhookFiltersSchema>;

const DEFAULT_WEBHOOK_FILTERS = WebhookFiltersSchema.parse({});

const WebhookEnvelopeSchema = {
  version: z.literal(WEBHOOK_PAYLOAD_VERSION),
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
};

const WebhookJobDataSchema = z.object({
  kind: z.string(),
  label: z.string(),
  jobId: z.string(),
  subject: z.string().nullable(),
  subjectName: z.string().nullable(),
});

const DiskRoomSchema = z.object({
  mountPoint: z.string(),
  totalBytes: z.number().nonnegative(),
  availableBytes: z.number().nonnegative(),
});

const WebhookMediaSchema = z.object({
  itemId: z.string(),
  kind: MediaKindSchema,
  title: z.string(),
  seriesTitle: z.string().nullable(),
  seasonNumber: z.number().int().nullable(),
  episodeNumber: z.number().int().nullable(),
  year: z.number().int().nullable(),
  posterUrl: z.string().url().nullable(),
  libraryId: z.string(),
  libraryName: z.string(),
  overview: z.string().nullable().default(null),
  durationSeconds: z.number().nonnegative().nullable().default(null),
  genres: z.array(z.string()).default([]),
  rating: z.number().nullable().default(null),
  quality: z.string().nullable().default(null),
});

const WebhookViewerSchema = z.object({
  accountId: z.string().nullable(),
  accountName: z.string().nullable(),
  profileId: z.string().nullable(),
  profileName: z.string().nullable(),
});

const WebhookPlaybackSchema = WebhookViewerSchema.extend({
  item: WebhookMediaSchema,
  deviceLabel: z.string(),
  mode: z.enum(PLAYBACK_MODES),
});

const ARRIVED_TITLES_KEPT = 25;

const ScannedLibrarySchema = z.object({
  libraryId: z.string(),
  libraryName: z.string(),
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  arrived: z.array(z.string()).max(ARRIVED_TITLES_KEPT).default([]),
  arrivedNotListed: z.number().int().nonnegative().default(0),
});

type ScannedLibrary = z.infer<typeof ScannedLibrarySchema>;

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
      libraries: z.array(ScannedLibrarySchema).min(1),
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
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('auth.succeeded'),
    data: z.object({
      accountId: z.string(),
      name: z.string(),
      deviceLabel: z.string(),
      address: z.string().nullable(),
    }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('auth.failed'),
    data: z.object({
      identifier: z.string(),
      deviceLabel: z.string(),
      address: z.string().nullable(),
      reason: z.string(),
    }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('account.created'),
    data: z.object({ accountId: z.string(), name: z.string() }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('account.deleted'),
    data: z.object({ accountId: z.string(), name: z.string() }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('account.roleChanged'),
    data: z.object({
      accountId: z.string(),
      name: z.string(),
      role: z.string(),
      change: z.enum(['given', 'taken']),
    }),
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('media.added'),
    data: WebhookMediaSchema,
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('media.removed'),
    data: WebhookMediaSchema,
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('playback.started'),
    data: WebhookPlaybackSchema,
  }),
  z.object({
    ...WebhookEnvelopeSchema,
    event: z.literal('playback.stopped'),
    data: WebhookPlaybackSchema.extend({
      positionSeconds: z.number().nonnegative().nullable(),
      durationSeconds: z.number().nonnegative().nullable(),
    }),
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
    filters: WebhookFiltersSchema.prefault({}),
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
  ARRIVED_TITLES_KEPT,
  WEBHOOK_EVENT_GROUPS,
  WEBHOOK_EVENT_NOTES,
  WEBHOOK_SUBSCRIBABLE_EVENTS,
  WebhookSubscribableEventSchema,
  isSubscribableEvent,
  DEFAULT_WEBHOOK_FILTERS,
  MEDIA_ADDED_GRANULARITIES,
  MediaAddedGranularitySchema,
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_PAYLOAD_VERSION,
  WEBHOOK_PRESETS,
  WebhookDeliveryResultSchema,
  WebhookDeliverySchema,
  WebhookEventSchema,
  WebhookFiltersSchema,
  WebhookJobDataSchema,
  WebhookPayloadSchema,
  ScannedLibrarySchema,
  WebhookPresetSchema,
  WebhookSubscriptionSchema,
};

export type {
  MediaAddedGranularity,
  ScannedLibrary,
  WebhookSubscribableEvent,
  WebhookEventGroup,
  WebhookDelivery,
  WebhookDeliveryResult,
  WebhookEvent,
  WebhookFilters,
  WebhookPayload,
  WebhookPreset,
  WebhookSubscription,
};
