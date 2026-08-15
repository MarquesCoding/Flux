import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator, TEST_ORIGIN } from '@FluxServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import { createMemoryWebhookStore } from '@FluxServer/webhooks/createMemoryWebhookStore';
import { WebhookDeliverySchema, WebhookSubscriptionSchema } from '@FluxContracts/schemas/Webhook';
import type { Permission } from '@FluxContracts/schemas/Permission';

const WebhookListSchema = z.object({ webhooks: z.array(WebhookSubscriptionSchema) });

const CreatedWebhookSchema = WebhookSubscriptionSchema.extend({ secret: z.string() });

const DeliveryListSchema = z.object({ deliveries: z.array(WebhookDeliverySchema) });

const aSubscription = {
  name: 'Discord',
  url: 'https://discord.com/api/webhooks/1/abc',
  preset: 'discord',
  events: ['job.failed'],
};

const signedInWith = async (granted: readonly Permission[]) => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();
  const webhooks = createMemoryWebhookStore();
  const queueWebhookDelivery = vi.fn<(id: string, payload: string) => Promise<void>>(() =>
    Promise.resolve(),
  );

  const app = createApp({
    auth,
    settings,
    permissions,
    webhooks,
    queueWebhookDelivery,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
  });

  const cookie = await signUpForTest(app);
  const account = store.user[0];

  if (granted.includes('administrator')) {
    await makeAdministrator(permissions, account?.id ?? '');
  } else {
    const role = await permissions.createRole({
      name: 'Purpose-made',
      position: 200,
      permissions: [...granted],
    });

    await permissions.assignRole(account?.id ?? '', role.id);
  }

  const request = (path: string, method = 'GET', body?: object) =>
    app.request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: {
        cookie,
        origin: TEST_ORIGIN,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const create = async (body: object = aSubscription) =>
    CreatedWebhookSchema.parse(await (await request('/api/webhooks', 'POST', body)).json());

  return { app, request, create, queueWebhookDelivery, webhooks };
};

const asKeeper = () => signedInWith(['server.webhooks']);

describe('the webhook routes', () => {
  it('lists nothing on a server nobody has set one up on', async () => {
    const { request } = await asKeeper();

    const listed = WebhookListSchema.parse(await (await request('/api/webhooks')).json());

    expect(listed.webhooks).toStrictEqual([]);
  });

  it('answers the secret once, on creation', async () => {
    const { create } = await asKeeper();

    const made = await create();

    expect(made.secret).not.toBe('');
    expect(made.name).toBe('Discord');
  });

  it('never answers the secret again', async () => {
    const { request, create } = await asKeeper();

    await create();

    const body = await (await request('/api/webhooks')).text();

    expect(body).not.toContain('whsec');
    expect(body).not.toContain('secret');
  });

  it('refuses an address Flux will not send to, rather than failing later', async () => {
    const { request } = await asKeeper();

    const response = await request('/api/webhooks', 'POST', {
      ...aSubscription,
      url: 'http://169.254.169.254/latest/meta-data/',
    });

    expect(response.status).toBe(400);
  });

  it('refuses a subscription that listens for nothing', async () => {
    const { request } = await asKeeper();

    const response = await request('/api/webhooks', 'POST', { ...aSubscription, events: [] });

    expect(response.status).toBe(400);
  });

  it('turns one off without destroying it', async () => {
    const { request, create } = await asKeeper();
    const made = await create();

    const response = await request(`/api/webhooks/${made.id}`, 'PATCH', { enabled: false });
    const changed = WebhookSubscriptionSchema.parse(await response.json());

    expect(changed.enabled).toBe(false);

    const listed = WebhookListSchema.parse(await (await request('/api/webhooks')).json());

    expect(listed.webhooks).toHaveLength(1);
  });

  it('deletes one', async () => {
    const { request, create } = await asKeeper();
    const made = await create();

    expect((await request(`/api/webhooks/${made.id}`, 'DELETE')).status).toBe(204);

    const listed = WebhookListSchema.parse(await (await request('/api/webhooks')).json());

    expect(listed.webhooks).toStrictEqual([]);
  });

  it('says so when there is no such subscription', async () => {
    const { request } = await asKeeper();
    const missing = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    expect((await request(`/api/webhooks/${missing}`, 'DELETE')).status).toBe(404);
    expect((await request(`/api/webhooks/${missing}`, 'PATCH', { enabled: false })).status).toBe(
      404,
    );
    expect((await request(`/api/webhooks/${missing}/test`, 'POST')).status).toBe(404);
  });

  it('queues a test through the same path a real delivery takes', async () => {
    const { request, create, queueWebhookDelivery } = await asKeeper();
    const made = await create();

    const response = await request(`/api/webhooks/${made.id}/test`, 'POST');

    expect(response.status).toBe(202);
    expect(queueWebhookDelivery).toHaveBeenCalledTimes(1);
    expect(queueWebhookDelivery.mock.calls[0]?.[0]).toBe(made.id);
  });

  it('has nothing to test on a subscription that is turned off', async () => {
    const { request, create, queueWebhookDelivery } = await asKeeper();
    const made = await create();

    await request(`/api/webhooks/${made.id}`, 'PATCH', { enabled: false });

    expect((await request(`/api/webhooks/${made.id}/test`, 'POST')).status).toBe(404);
    expect(queueWebhookDelivery).not.toHaveBeenCalled();
  });

  it('refuses an account that may not manage webhooks', async () => {
    const { request } = await signedInWith(['server.settings', 'server.logs']);

    expect((await request('/api/webhooks')).status).toBe(403);
    expect((await request('/api/webhooks', 'POST', aSubscription)).status).toBe(403);
  });

  it('lets an administrator manage them without being granted it separately', async () => {
    const { request } = await signedInWith(['administrator']);

    expect((await request('/api/webhooks')).status).toBe(200);
  });

  it('has an empty history for a subscription nothing has been sent to', async () => {
    const { request, create } = await asKeeper();
    const made = await create();

    const read = DeliveryListSchema.parse(
      await (await request(`/api/webhooks/${made.id}/deliveries`)).json(),
    );

    expect(read.deliveries).toStrictEqual([]);
  });

  it('tells an empty history apart from a subscription that is not there', async () => {
    const { request } = await asKeeper();

    const response = await request('/api/webhooks/3f2504e0-4f89-41d3-9a0c-0305e82c3301/deliveries');

    expect(response.status).toBe(404);
  });

  it('shows what was sent, and how many tries it took', async () => {
    const { request, create, webhooks } = await asKeeper();
    const made = await create();

    await webhooks.recordDelivery(
      {
        subscriptionId: made.id,
        eventId: 'event-1',
        event: 'job.failed',
        body: '{"id":"event-1"}',
      },
      { ok: false, status: 503, error: 'The receiver answered 503.' },
    );

    const read = DeliveryListSchema.parse(
      await (await request(`/api/webhooks/${made.id}/deliveries`)).json(),
    );

    expect(read.deliveries[0]).toMatchObject({ event: 'job.failed', attempts: 1, status: 503 });
  });

  it('does not answer the body it kept for resending', async () => {
    const { request, create, webhooks } = await asKeeper();
    const made = await create();

    await webhooks.recordDelivery(
      {
        subscriptionId: made.id,
        eventId: 'event-1',
        event: 'job.failed',
        body: '{"secretish":"do not answer this"}',
      },
      { ok: true, status: 200, error: null },
    );

    const body = await (await request(`/api/webhooks/${made.id}/deliveries`)).text();

    expect(body).not.toContain('do not answer this');
  });

  it('sends a delivery again, with the bytes it kept', async () => {
    const { request, create, webhooks, queueWebhookDelivery } = await asKeeper();
    const made = await create();

    await webhooks.recordDelivery(
      { subscriptionId: made.id, eventId: 'event-1', event: 'job.failed', body: '{"id":"one"}' },
      { ok: false, status: 503, error: 'The receiver answered 503.' },
    );

    const [filed] = await webhooks.listDeliveries(made.id, 10);

    const response = await request(
      `/api/webhooks/${made.id}/deliveries/${filed?.id ?? ''}/redeliver`,
      'POST',
    );

    expect(response.status).toBe(202);
    expect(queueWebhookDelivery).toHaveBeenCalledWith(made.id, '{"id":"one"}');
  });

  it('has nothing to send again for a delivery that never happened', async () => {
    const { request, create, queueWebhookDelivery } = await asKeeper();
    const made = await create();

    const response = await request(
      `/api/webhooks/${made.id}/deliveries/3f2504e0-4f89-41d3-9a0c-0305e82c3399/redeliver`,
      'POST',
    );

    expect(response.status).toBe(404);
    expect(queueWebhookDelivery).not.toHaveBeenCalled();
  });

  it('keeps the history behind the same permission as the rest', async () => {
    const { request } = await signedInWith(['server.settings']);
    const anyId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    expect((await request(`/api/webhooks/${anyId}/deliveries`)).status).toBe(403);
    expect(
      (await request(`/api/webhooks/${anyId}/deliveries/${anyId}/redeliver`, 'POST')).status,
    ).toBe(403);
  });

  it('refuses somebody who is not signed in', async () => {
    const { app } = await asKeeper();

    const response = await app.request(`${TEST_ORIGIN}/api/webhooks`, {
      headers: { origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(401);
  });
});
