import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWebhook,
  deleteWebhook,
  fetchWebhooks,
  setWebhookEnabled,
  testWebhook,
} from './fetchWebhooks';

const aSubscription = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
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

const answering = (body: object, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWebhooks', () => {
  it('reads the subscriptions', async () => {
    vi.stubGlobal('fetch', answering({ webhooks: [aSubscription] }));

    const read = await fetchWebhooks();

    expect(read).toHaveLength(1);
    expect(read[0]?.name).toBe('Discord');
  });

  it('shows nothing rather than breaking when the server refuses', async () => {
    vi.stubGlobal('fetch', answering({ error: 'This account may not manage webhooks.' }, 403));

    expect(await fetchWebhooks()).toStrictEqual([]);
  });

  it('shows nothing rather than breaking when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await fetchWebhooks()).toStrictEqual([]);
  });
});

describe('createWebhook', () => {
  it('answers the secret, which is the only time it can be read', async () => {
    vi.stubGlobal('fetch', answering({ ...aSubscription, secret: 'whsec_abc' }, 201));

    const { created, refusal } = await createWebhook({
      name: 'Discord',
      url: 'https://discord.com/api/webhooks/1/abc',
      preset: 'discord',
      events: ['job.failed'],
    });

    expect(refusal).toBeNull();
    expect(created?.secret).toBe('whsec_abc');
  });

  it('carries back why an address was refused rather than saying it went wrong', async () => {
    vi.stubGlobal(
      'fetch',
      answering({ error: 'Flux will not send deliveries to that address.' }, 400),
    );

    const { created, refusal } = await createWebhook({
      name: 'Metadata',
      url: 'http://169.254.169.254/',
      preset: 'generic',
      events: ['job.failed'],
    });

    expect(created).toBeNull();
    expect(refusal?.message).toContain('will not send deliveries');
  });

  it('says so plainly when the server could not be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const { refusal } = await createWebhook({
      name: 'Discord',
      url: 'https://discord.com/api/webhooks/1/abc',
      preset: 'discord',
      events: ['job.failed'],
    });

    expect(refusal?.message).toContain('could not be reached');
  });
});

describe('setWebhookEnabled', () => {
  it('reports nothing wrong when it worked', async () => {
    vi.stubGlobal('fetch', answering(aSubscription));

    expect(await setWebhookEnabled(aSubscription.id, false)).toBeNull();
  });

  it('carries back a refusal', async () => {
    vi.stubGlobal('fetch', answering({ error: 'No such subscription.' }, 404));

    expect((await setWebhookEnabled(aSubscription.id, false))?.message).toBe(
      'No such subscription.',
    );
  });
});

describe('deleteWebhook', () => {
  it('reports nothing wrong when it worked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    expect(await deleteWebhook(aSubscription.id)).toBeNull();
  });
});

describe('testWebhook', () => {
  it('reports nothing wrong once the delivery is queued', async () => {
    vi.stubGlobal('fetch', answering({ queued: true }, 202));

    expect(await testWebhook(aSubscription.id)).toBeNull();
  });

  it('carries back a refusal for a subscription that is turned off', async () => {
    vi.stubGlobal('fetch', answering({ error: 'No such subscription, or it is turned off.' }, 404));

    expect((await testWebhook(aSubscription.id))?.message).toContain('turned off');
  });
});
