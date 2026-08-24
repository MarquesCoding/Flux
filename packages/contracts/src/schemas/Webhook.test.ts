import { describe, expect, it } from 'vitest';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_GROUPS,
  WEBHOOK_SUBSCRIBABLE_EVENTS,
  isSubscribableEvent,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_PAYLOAD_VERSION,
  WebhookPayloadSchema,
  WebhookFiltersSchema,
  WebhookSubscriptionSchema,
} from './Webhook';

const anEnvelope = {
  version: WEBHOOK_PAYLOAD_VERSION,
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  occurredAt: '2026-08-14T20:00:00.000Z',
};

const aSubscription = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
  name: 'Discord',
  url: 'https://discord.com/api/webhooks/1/abc',
  preset: 'discord',
  events: ['job.failed'],
  enabled: true,
  createdAt: '2026-08-14T20:00:00.000Z',
  lastAttemptAt: null,
  lastStatus: null,
  lastError: null,
};

describe('WEBHOOK_EVENT_LABELS', () => {
  it('names every event in the catalogue', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(WEBHOOK_EVENT_LABELS[event]).not.toBe('');
    }
  });

  it('keeps a label short enough to scan in a list rather than read as a sentence', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(WEBHOOK_EVENT_LABELS[event].length).toBeLessThanOrEqual(24);
    }
  });
});

describe('WEBHOOK_EVENTS', () => {
  it('pairs everything that can break with the news that it mended', () => {
    const breakages = WEBHOOK_EVENTS.filter((event) => event.endsWith('.unreachable'));

    for (const breakage of breakages) {
      const recovery = breakage.replace('.unreachable', '.reachable');

      expect(WEBHOOK_EVENTS).toContain(recovery);
    }

    expect(breakages.length).toBeGreaterThan(0);
  });
});

describe('WebhookPayloadSchema', () => {
  it('reads a job failure with the job it was about', () => {
    const payload = WebhookPayloadSchema.parse({
      ...anEnvelope,
      event: 'job.failed',
      data: {
        kind: 'library.scan',
        label: 'Scan for changes',
        jobId: 'job-1',
        subject: 'library-1',
        subjectName: 'Films',
        reason: 'ffmpeg exited with 1',
      },
    });

    expect(payload.event).toBe('job.failed');
    expect(payload.data).toMatchObject({ kind: 'library.scan', subject: 'library-1' });
  });

  it('keeps a job that ran against nothing in particular', () => {
    const payload = WebhookPayloadSchema.parse({
      ...anEnvelope,
      event: 'job.completed',
      data: {
        kind: 'server.cleanupSessions',
        label: 'Clean up sessions',
        jobId: 'job-2',
        subject: null,
        subjectName: null,
      },
    });

    expect(payload.data).toMatchObject({ subject: null });
  });

  it('refuses an event nothing raises', () => {
    const read = WebhookPayloadSchema.safeParse({
      ...anEnvelope,
      event: 'library.burgled',
      data: {},
    });

    expect(read.success).toBe(false);
  });

  it('refuses an arrival that does not say what arrived', () => {
    const read = WebhookPayloadSchema.safeParse({
      ...anEnvelope,
      event: 'media.added',
      data: {},
    });

    expect(read.success).toBe(false);
  });

  it('carries an arrival with the poster the catalogue wrote', () => {
    const payload = WebhookPayloadSchema.parse({
      ...anEnvelope,
      event: 'media.added',
      data: {
        itemId: 'item-1',
        kind: 'movie',
        title: 'Dune',
        seriesTitle: null,
        seasonNumber: null,
        episodeNumber: null,
        year: 2021,
        posterUrl: 'https://image.tmdb.org/t/p/w500/dune.jpg',
        libraryId: 'library-1',
        libraryName: 'Films',
      },
    });

    expect(payload.data).toMatchObject({ kind: 'movie', title: 'Dune' });
  });

  it('carries an arrival that the catalogue never matched, which has no poster', () => {
    const payload = WebhookPayloadSchema.parse({
      ...anEnvelope,
      event: 'media.added',
      data: {
        itemId: 'item-2',
        kind: 'movie',
        title: 'Home video',
        seriesTitle: null,
        seasonNumber: null,
        episodeNumber: null,
        year: null,
        posterUrl: null,
        libraryId: 'library-1',
        libraryName: 'Films',
      },
    });

    expect(payload.data).toMatchObject({ posterUrl: null });
  });

  it('lets a viewing name nobody, because a share link is watched by nobody', () => {
    const payload = WebhookPayloadSchema.parse({
      ...anEnvelope,
      event: 'playback.started',
      data: {
        accountId: null,
        accountName: null,
        profileId: null,
        profileName: null,
        item: {
          itemId: 'item-1',
          kind: 'movie',
          title: 'Dune',
          seriesTitle: null,
          seasonNumber: null,
          episodeNumber: null,
          year: 2021,
          posterUrl: null,
          libraryId: 'library-1',
          libraryName: 'Films',
        },
        deviceLabel: 'Chrome on macOS',
        mode: 'DirectPlay',
      },
    });

    expect(payload.data).toMatchObject({ accountId: null, profileId: null });
  });

  it('reads a library that has not been told what arrived as one that says nothing arrived', () => {
    const payload = WebhookPayloadSchema.parse({
      ...anEnvelope,
      event: 'library.scanned',
      data: {
        libraries: [
          {
            libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
            libraryName: 'Films',
            added: 0,
            updated: 0,
            removed: 0,
            failed: 0,
          },
        ],
        added: 0,
        updated: 0,
        removed: 0,
        failed: 0,
      },
    });

    expect(payload.event).toBe('library.scanned');
    expect(payload.data).toMatchObject({
      libraries: [expect.objectContaining({ arrived: [], arrivedNotListed: 0 })],
    });
  });

  it('refuses a scan that names no library at all', () => {
    const read = WebhookPayloadSchema.safeParse({
      ...anEnvelope,
      event: 'library.scanned',
      data: { libraries: [], added: 0, updated: 0, removed: 0, failed: 0 },
    });

    expect(read.success).toBe(false);
  });

  it('refuses an envelope from a version it does not speak', () => {
    const read = WebhookPayloadSchema.safeParse({
      ...anEnvelope,
      version: 2,
      event: 'webhook.test',
      data: {},
    });

    expect(read.success).toBe(false);
  });

  it('refuses a failure that does not say why', () => {
    const read = WebhookPayloadSchema.safeParse({
      ...anEnvelope,
      event: 'job.failed',
      data: {
        kind: 'library.scan',
        label: 'Scan for changes',
        jobId: 'job-1',
        subject: null,
        subjectName: null,
      },
    });

    expect(read.success).toBe(false);
  });
});

describe('WebhookSubscriptionSchema', () => {
  it('reads a subscription that has never been delivered to', () => {
    const subscription = WebhookSubscriptionSchema.parse(aSubscription);

    expect(subscription.lastAttemptAt).toBeNull();
    expect(subscription.lastStatus).toBeNull();
  });

  it('carries the result of the last attempt', () => {
    const subscription = WebhookSubscriptionSchema.parse({
      ...aSubscription,
      lastAttemptAt: '2026-08-14T20:05:00.000Z',
      lastStatus: 500,
      lastError: 'Internal Server Error',
    });

    expect(subscription).toMatchObject({ lastStatus: 500, lastError: 'Internal Server Error' });
  });

  it('refuses a subscription that listens for nothing', () => {
    const read = WebhookSubscriptionSchema.safeParse({ ...aSubscription, events: [] });

    expect(read.success).toBe(false);
  });

  it('refuses somewhere that is not a URL', () => {
    const read = WebhookSubscriptionSchema.safeParse({ ...aSubscription, url: 'not a url' });

    expect(read.success).toBe(false);
  });

  it('does not carry the signing secret', () => {
    const subscription = WebhookSubscriptionSchema.parse({
      ...aSubscription,
      secret: 'whsec_should_not_survive',
    });

    expect(Object.keys(subscription)).not.toContain('secret');
  });
});

describe('WebhookFiltersSchema', () => {
  it('reads an empty object as a subscription that has chosen nothing in particular', () => {
    expect(WebhookFiltersSchema.parse({})).toStrictEqual({
      mediaAdded: 'perScan',
      accounts: [],
      profiles: [],
      itemTypes: [],
    });
  });

  it('keeps a subscription that asked to hear about arrivals one at a time', () => {
    expect(WebhookFiltersSchema.parse({ mediaAdded: 'perItem' })).toStrictEqual({
      mediaAdded: 'perItem',
      accounts: [],
      profiles: [],
      itemTypes: [],
    });
  });

  it('refuses a granularity it does not offer', () => {
    expect(WebhookFiltersSchema.safeParse({ mediaAdded: 'hourly' }).success).toBe(false);
  });

  it('gives a subscription stored before filters existed the same filters as a new one', () => {
    const subscription = WebhookSubscriptionSchema.parse(aSubscription);

    expect(subscription.filters).toStrictEqual({
      mediaAdded: 'perScan',
      accounts: [],
      profiles: [],
      itemTypes: [],
    });
  });
});

describe('WebhookFiltersSchema, the allowlists', () => {
  it('reads an allowlist that names people', () => {
    const filters = WebhookFiltersSchema.parse({
      accounts: ['account-1'],
      profiles: ['profile-1'],
      itemTypes: ['movie', 'book'],
    });

    expect(filters).toMatchObject({
      accounts: ['account-1'],
      profiles: ['profile-1'],
      itemTypes: ['movie', 'book'],
    });
  });

  it('admits a book, which ADR-0027 says is not a media item', () => {
    expect(WebhookFiltersSchema.safeParse({ itemTypes: ['book'] }).success).toBe(true);
  });

  it('refuses a kind of thing Valence does not have', () => {
    expect(WebhookFiltersSchema.safeParse({ itemTypes: ['podcast'] }).success).toBe(false);
  });
});

describe('WEBHOOK_EVENT_GROUPS', () => {
  const grouped = WEBHOOK_EVENT_GROUPS.flatMap((group) => [...group.events]);

  it('finds a home for every event somebody can subscribe to', () => {
    for (const event of WEBHOOK_SUBSCRIBABLE_EVENTS) {
      expect(grouped).toContain(event);
    }
  });

  it('does not offer the test delivery, which is a button rather than a subscription', () => {
    expect(grouped).not.toContain('webhook.test');
  });

  it('puts each event in one group only, so nothing is offered twice', () => {
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('offers nothing that is not an event', () => {
    for (const event of grouped) {
      expect(WEBHOOK_EVENTS).toContain(event);
    }
  });

  it('names each group', () => {
    for (const group of WEBHOOK_EVENT_GROUPS) {
      expect(group.label).not.toBe('');
    }
  });
});

describe('WEBHOOK_SUBSCRIBABLE_EVENTS', () => {
  it('leaves out the test delivery, which is sent by pressing a button', () => {
    expect(WEBHOOK_SUBSCRIBABLE_EVENTS).not.toContain('webhook.test');
  });

  it('offers everything else, so nothing real becomes unsubscribable by accident', () => {
    for (const event of WEBHOOK_EVENTS) {
      if (event !== 'webhook.test') {
        expect(WEBHOOK_SUBSCRIBABLE_EVENTS).toContain(event);
      }
    }
  });

  it('still lets a test delivery be read back, since one can be sent and recorded', () => {
    expect(
      WebhookPayloadSchema.safeParse({ ...anEnvelope, event: 'webhook.test', data: {} }).success,
    ).toBe(true);
  });
});

describe('isSubscribableEvent', () => {
  it('admits an event somebody can ask for', () => {
    expect(isSubscribableEvent('playback.started')).toBe(true);
  });

  it('rejects the test delivery, which Valence only ever sends by itself', () => {
    expect(isSubscribableEvent('webhook.test')).toBe(false);
  });

  it('agrees with the list, so the two cannot drift apart', () => {
    for (const event of WEBHOOK_EVENTS) {
      const listed = WEBHOOK_SUBSCRIBABLE_EVENTS.some((offered) => offered === event);

      expect(isSubscribableEvent(event)).toBe(listed);
    }
  });
});
