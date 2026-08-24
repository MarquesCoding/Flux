import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_PAYLOAD_VERSION } from '@ValenceContracts/schemas/Webhook';
import { createMemoryWebhookStore } from './createMemoryWebhookStore';
import { runWebhookDelivery } from './runWebhookDelivery';
import type { WebhookFetcher } from './deliverWebhook';
import type { WebhookStore } from './WebhookStore';
import { z } from 'zod';
import type { Mock } from 'vitest';

const DiscordMessageSchema = z.object({
  embeds: z.array(
    z.object({
      title: z.string(),
      thumbnail: z.object({ url: z.string() }).optional(),
    }),
  ),
});

const anEnvelope = JSON.stringify({
  version: WEBHOOK_PAYLOAD_VERSION,
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  occurredAt: '2026-08-14T20:00:00.000Z',
  event: 'job.failed',
  data: {
    kind: 'library.scan',
    label: 'Scan for changes',
    jobId: 'job-1',
    subject: null,
    subjectName: null,
    reason: 'no space left',
  },
});

const answering = (status: number): Mock<WebhookFetcher> =>
  vi.fn<WebhookFetcher>().mockResolvedValue({ ok: status >= 200 && status < 300, status });

let subscriptions: WebhookStore;

beforeEach(() => {
  subscriptions = createMemoryWebhookStore();
});

const aSubscription = async () =>
  subscriptions.create({
    name: 'Discord',
    url: 'https://example.com/hook',
    preset: 'generic',
    events: ['job.failed'],
  });

describe('runWebhookDelivery', () => {
  it('delivers, and is done with it', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('asks to be retried when the receiver answered badly', async () => {
    const { subscription } = await aSubscription();

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(503),
    });

    expect(done).toBe(false);
  });

  it('records how it went either way', async () => {
    const { subscription } = await aSubscription();

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(503),
    });

    const [read] = await subscriptions.list();

    expect(read).toMatchObject({ lastStatus: 503 });
    expect(read?.lastError).toContain('503');
  });

  it('does not retry a subscription somebody turned off in the meantime', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    await subscriptions.update(subscription.id, { enabled: false });

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not retry a subscription that has been deleted', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    await subscriptions.remove(subscription.id);

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('files what it sent, so the history shows more than the last attempt', async () => {
    const { subscription } = await aSubscription();

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(200),
    });

    const [filed] = await subscriptions.listDeliveries(subscription.id, 10);

    expect(filed).toMatchObject({ event: 'job.failed', attempts: 1, ok: true, status: 200 });
  });

  it('counts a retry against the delivery it belongs to', async () => {
    const { subscription } = await aSubscription();

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(503),
    });

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(200),
    });

    const filed = await subscriptions.listDeliveries(subscription.id, 10);

    expect(filed).toHaveLength(1);
    expect(filed[0]).toMatchObject({ attempts: 2, ok: true });
  });

  it('gives up on an envelope it cannot read rather than retrying it for ever', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: JSON.stringify({ version: 99, event: 'nothing.happened' }),
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();

    const [read] = await subscriptions.list();

    expect(read?.lastError).toContain('could not be read');
  });
});

describe('runWebhookDelivery, redelivering a Discord message', () => {
  const anArrival = JSON.stringify({
    version: WEBHOOK_PAYLOAD_VERSION,
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
    occurredAt: '2026-08-14T20:00:00.000Z',
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

  const toDiscord = async () =>
    subscriptions.create({
      name: 'Discord',
      url: 'https://example.com/hook',
      preset: 'discord',
      events: ['media.added'],
      filters: { mediaAdded: 'perItem', accounts: [], profiles: [], itemTypes: [] },
    });

  it('sends an embed rather than a line of text', async () => {
    const { subscription } = await toDiscord();
    const fetchImpl = answering(204);

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anArrival,
      fetchImpl,
    });

    const sent = DiscordMessageSchema.parse(JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body)));

    expect(sent.embeds[0]?.title).toBe('Dune (2021)');
    expect(sent.embeds[0]?.thumbnail?.url).toBe('https://image.tmdb.org/t/p/w500/dune.jpg');
  });

  it('stores the event rather than the message, so a redelivery can be formatted again', async () => {
    const { subscription } = await toDiscord();

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anArrival,
      fetchImpl: answering(204),
    });

    const kept = await subscriptions.readDeliveryBody(
      subscription.id,
      (await subscriptions.listDeliveries(subscription.id, 1))[0]?.id ?? '',
    );

    expect(kept).toBe(anArrival);
  });

  it('produces the identical message when the same delivery is sent again', async () => {
    const { subscription } = await toDiscord();
    const first = answering(500);
    const second = answering(204);

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anArrival,
      fetchImpl: first,
    });

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anArrival,
      fetchImpl: second,
    });

    expect(second.mock.calls[0]?.[1].body).toBe(first.mock.calls[0]?.[1].body);
  });
});
