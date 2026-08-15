import { describe, expect, it } from 'vitest';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_PAYLOAD_VERSION,
  WebhookPayloadSchema,
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
        jobId: 'job-1',
        subject: 'library-1',
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
      data: { kind: 'server.cleanupSessions', jobId: 'job-2', subject: null },
    });

    expect(payload.data).toMatchObject({ subject: null });
  });

  it('refuses an event nothing raises', () => {
    const read = WebhookPayloadSchema.safeParse({
      ...anEnvelope,
      event: 'media.added',
      data: {},
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
      data: { kind: 'library.scan', jobId: 'job-1', subject: null },
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
