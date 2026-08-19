import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNotifications,
  fetchNotificationSettings,
  markNotificationsRead,
} from './fetchNotifications';

const fetchMock = vi.fn();

const said = (body: object, ok = true) => ({ ok, json: () => Promise.resolve(body) });

const A_NOTICE = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  event: 'media.added',
  title: 'Arrival',
  body: 'Added to Films',
  link: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  readAt: null,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNotifications', () => {
  it('answers with what is waiting, and asks for it as json', async () => {
    fetchMock.mockResolvedValue(said({ notifications: [A_NOTICE], unread: 1 }));

    await expect(fetchNotifications()).resolves.toMatchObject({ unread: 1 });

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications', {
      headers: { accept: 'application/json' },
    });
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(fetchNotifications()).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(fetchNotifications()).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said({ notifications: 'lots' }));

    await expect(fetchNotifications()).rejects.toThrow();
  });
});

describe('markNotificationsRead', () => {
  it('marks one and says how many are left', async () => {
    fetchMock.mockResolvedValue(said({ unread: 2 }));

    await expect(markNotificationsRead(A_NOTICE.id)).resolves.toBe(2);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/read',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ id: A_NOTICE.id }) }),
    );
  });

  it('marks the lot when told about none in particular', async () => {
    fetchMock.mockResolvedValue(said({ unread: 0 }));

    await markNotificationsRead();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/read',
      expect.objectContaining({ body: '{}' }),
    );
  });

  it('says none are left rather than failing, when the server refuses or cannot be reached', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(markNotificationsRead()).resolves.toBe(0);

    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(markNotificationsRead()).resolves.toBe(0);
  });

  it('says none are left when the answer is not one', async () => {
    fetchMock.mockResolvedValue(said({ unread: 'two' }));

    await expect(markNotificationsRead()).resolves.toBe(0);
  });
});

describe('fetchNotificationSettings', () => {
  it('answers with what was chosen, and asks for it as json', async () => {
    fetchMock.mockResolvedValue(said({ preferences: [], pushPublicKey: 'a-key' }));

    await expect(fetchNotificationSettings()).resolves.toMatchObject({ pushPublicKey: 'a-key' });

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/preferences', {
      headers: { accept: 'application/json' },
    });
  });

  it('says so when the server refuses, and when it cannot be reached at all', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(fetchNotificationSettings()).rejects.toThrow();

    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(fetchNotificationSettings()).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    fetchMock.mockResolvedValue(said({ preferences: {} }));

    await expect(fetchNotificationSettings()).rejects.toThrow();
  });
});

describe('markNotificationsRead, given an answer it cannot read', () => {
  it('reports nothing unread rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new Error('not json')),
        }),
      ),
    );

    await expect(markNotificationsRead('one')).resolves.toBe(0);
  });
});
