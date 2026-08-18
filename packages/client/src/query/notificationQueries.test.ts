import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationQueries } from './notificationQueries';

const fetchNotifications = vi.hoisted(() => vi.fn());
const fetchNotificationSettings = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/notifications/fetchNotifications', () => ({
  fetchNotifications,
  fetchNotificationSettings,
}));

const aCache = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  vi.clearAllMocks();

  fetchNotifications.mockResolvedValue({ notifications: [], unread: 0 });
  fetchNotificationSettings.mockResolvedValue({ pushPublicKey: 'key', preferences: [] });
});

describe('notificationQueries', () => {
  it('asks what is waiting to be read', async () => {
    await expect(aCache().fetchQuery(notificationQueries.inbox())).resolves.toEqual({
      notifications: [],
      unread: 0,
    });
  });

  it('asks what this account has said it wants to be told about', async () => {
    await expect(aCache().fetchQuery(notificationQueries.settings())).resolves.toMatchObject({
      pushPublicKey: 'key',
    });
  });

  it('holds both under one key, so one arriving refreshes both', () => {
    expect(notificationQueries.inbox().queryKey.slice(0, 1)).toEqual(notificationQueries.key);
    expect(notificationQueries.settings().queryKey.slice(0, 1)).toEqual(notificationQueries.key);
  });
});
