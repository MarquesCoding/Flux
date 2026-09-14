import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signUpForTest, TEST_ORIGIN } from '@ValenceServer/auth/signUpForTest';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { createMemoryNotificationStore } from '@ValenceServer/notifications/createMemoryNotificationStore';
import {
  NotificationPreferenceSchema,
  NotificationSchema,
} from '@ValenceContracts/schemas/Notification';

const ListSchema = z.object({
  notifications: z.array(NotificationSchema),
  unread: z.number(),
});

const PreferencesSchema = z.object({
  preferences: z.array(NotificationPreferenceSchema),
  pushPublicKey: z.string(),
});

const someNews = {
  event: 'media.added' as const,
  title: 'Something new to watch',
  body: '12 episodes — The Office',
  link: '/?show=s1',
};

const signedIn = async () => {
  const { auth, settings, store } = createMemoryAuth();
  const notifications = createMemoryNotificationStore({
    listAccountIds: () => Promise.resolve(store.user.map((row) => row.id)),
  });

  const app = createApp({
    auth,
    settings,
    notifications,
    readPushPublicKey: () => Promise.resolve('a-public-key'),
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
    ratings: createMemoryRatingService(),
  });

  const cookie = await signUpForTest(app);

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

  return { app, request, notifications, accountId: store.user[0]?.id ?? '' };
};

describe('push subscriptions', () => {
  it('does not let one account forget a browser belonging to another', async () => {
    const { app, request, notifications, accountId } = await signedIn();

    await request('/api/notifications/push', 'POST', {
      endpoint: 'https://push/mine',
      p256dh: 'k',
      auth: 'a',
    });

    const theirs = await signUpForTest(app, {
      name: 'Somebody else',
      email: 'else@valence.local',
      password: 'a-long-enough-password',
    });

    const response = await app.request(`${TEST_ORIGIN}/api/notifications/push`, {
      method: 'DELETE',
      headers: { cookie: theirs, origin: TEST_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://push/mine' }),
    });

    expect(theirs).not.toBe('');
    expect(response.status).toBe(204);
    expect(await notifications.listPushEndpoints(accountId)).toHaveLength(1);
  });

  it('forgets a browser for the account that registered it', async () => {
    const { request, notifications, accountId } = await signedIn();

    await request('/api/notifications/push', 'POST', {
      endpoint: 'https://push/mine',
      p256dh: 'k',
      auth: 'a',
    });

    await request('/api/notifications/push', 'DELETE', { endpoint: 'https://push/mine' });

    expect(await notifications.listPushEndpoints(accountId)).toStrictEqual([]);
  });
});

describe('the notification routes', () => {
  it('has nothing to show somebody nothing has happened to', async () => {
    const { request } = await signedIn();

    const read = ListSchema.parse(await (await request('/api/notifications')).json());

    expect(read.notifications).toStrictEqual([]);
    expect(read.unread).toBe(0);
  });

  it('shows what this account was told', async () => {
    const { request, notifications, accountId } = await signedIn();

    await notifications.notify([accountId], someNews);

    const read = ListSchema.parse(await (await request('/api/notifications')).json());

    expect(read.notifications[0]?.body).toContain('The Office');
    expect(read.unread).toBe(1);
  });

  it('does not show somebody else what they were told', async () => {
    const { request, notifications } = await signedIn();

    await notifications.notify(['somebody-else'], someNews);

    const read = ListSchema.parse(await (await request('/api/notifications')).json());

    expect(read.notifications).toStrictEqual([]);
  });

  it('clears the lot', async () => {
    const { request, notifications, accountId } = await signedIn();

    await notifications.notify([accountId], someNews);
    await notifications.notify([accountId], someNews);

    const response = await request('/api/notifications/read', 'POST', {});

    expect(z.object({ unread: z.number() }).parse(await response.json()).unread).toBe(0);
  });

  it('clears one without clearing the rest', async () => {
    const { request, notifications, accountId } = await signedIn();

    await notifications.notify([accountId], someNews);
    await notifications.notify([accountId], someNews);

    const [newest] = await notifications.list(accountId, 10);

    const response = await request('/api/notifications/read', 'POST', { id: newest?.id });

    expect(z.object({ unread: z.number() }).parse(await response.json()).unread).toBe(1);
  });

  it('answers the defaults for an account that has chosen nothing', async () => {
    const { request } = await signedIn();

    const read = PreferencesSchema.parse(
      await (await request('/api/notifications/preferences')).json(),
    );

    expect(read.preferences).toStrictEqual([
      { event: 'media.added', inApp: true, push: false },
      { event: 'party.invited', inApp: true, push: false },
      { event: 'sharing.withdrawn', inApp: true, push: false },
    ]);
  });

  it('hands a browser the key it needs to subscribe', async () => {
    const { request } = await signedIn();

    const read = PreferencesSchema.parse(
      await (await request('/api/notifications/preferences')).json(),
    );

    expect(read.pushPublicKey).toBe('a-public-key');
  });

  it('remembers what somebody chose', async () => {
    const { request } = await signedIn();

    await request('/api/notifications/preferences', 'PUT', {
      event: 'media.added',
      inApp: false,
      push: true,
    });

    const read = PreferencesSchema.parse(
      await (await request('/api/notifications/preferences')).json(),
    );

    expect(read.preferences[0]).toStrictEqual({ event: 'media.added', inApp: false, push: true });
  });

  it('registers a browser and forgets it again', async () => {
    const { request, notifications, accountId } = await signedIn();
    const endpoint = 'https://push.example.com/abc';

    expect(
      (await request('/api/notifications/push', 'POST', { endpoint, p256dh: 'k', auth: 'a' }))
        .status,
    ).toBe(204);
    expect(await notifications.listPushEndpoints(accountId)).toHaveLength(1);

    expect((await request('/api/notifications/push', 'DELETE', { endpoint })).status).toBe(204);
    expect(await notifications.listPushEndpoints(accountId)).toStrictEqual([]);
  });

  it('refuses somebody who is not signed in', async () => {
    const { app } = await signedIn();

    const response = await app.request(`${TEST_ORIGIN}/api/notifications`, {
      headers: { origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(401);
  });
});
