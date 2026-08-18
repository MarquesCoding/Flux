import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { canReceivePush, subscribeToPush, unsubscribeFromPush } from './subscribeToPush';

const fetchMock = vi.fn();
const requestPermission = vi.fn();
const register = vi.fn();
const getRegistration = vi.fn();
const subscribe = vi.fn();
const getSubscription = vi.fn();
const unsubscribe = vi.fn();

const A_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

/**
 * A browser that can be woken, with every part of the push machinery answering.
 */
const aBrowserThatCan = () => {
  const subscription = {
    endpoint: 'https://push.example/abc',
    getKey: (name: string) => new Uint8Array(name === 'auth' ? [1, 2, 3] : [4, 5, 6]).buffer,
    unsubscribe,
  };

  subscribe.mockResolvedValue(subscription);
  getSubscription.mockResolvedValue(subscription);
  register.mockResolvedValue({ pushManager: { subscribe } });
  getRegistration.mockResolvedValue({ pushManager: { getSubscription } });
  requestPermission.mockResolvedValue('granted');

  vi.stubGlobal('navigator', { serviceWorker: { register, getRegistration } });
  vi.stubGlobal('Notification', { requestPermission });
  vi.stubGlobal('PushManager', class {});

  return subscription;
};

beforeEach(() => {
  vi.clearAllMocks();

  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canReceivePush', () => {
  it('says yes when the browser has all three parts', () => {
    aBrowserThatCan();

    expect(canReceivePush()).toBe(true);
  });

  it('says no when the browser has none of them', () => {
    vi.stubGlobal('navigator', {});

    expect(canReceivePush()).toBe(false);
  });
});

describe('subscribeToPush', () => {
  it('tells the server where to knock', async () => {
    aBrowserThatCan();

    await expect(subscribeToPush(A_KEY)).resolves.toBe(true);

    expect(register).toHaveBeenCalledWith('/push-worker.js');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/push',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends the keys the browser handed back as text rather than as bytes', async () => {
    aBrowserThatCan();

    await subscribeToPush(A_KEY);

    const asked = z
      .object({ body: z.string() })
      .parse(fetchMock.mock.lastCall?.[1] ?? { body: '{}' });

    const body = z
      .object({ endpoint: z.string(), auth: z.string(), p256dh: z.string() })
      .parse(JSON.parse(asked.body));

    expect(body.endpoint).toBe('https://push.example/abc');
    expect(body.auth).not.toContain('=');
    expect(body.p256dh).not.toBe('');
  });

  it('does nothing where the browser cannot be woken, or nobody said what key to use', async () => {
    vi.stubGlobal('navigator', {});

    await expect(subscribeToPush(A_KEY)).resolves.toBe(false);

    aBrowserThatCan();

    await expect(subscribeToPush('')).resolves.toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('takes a refusal for an answer rather than throwing', async () => {
    aBrowserThatCan();
    requestPermission.mockResolvedValue('denied');

    await expect(subscribeToPush(A_KEY)).resolves.toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('says it did not work when the server would not have it', async () => {
    aBrowserThatCan();
    fetchMock.mockResolvedValue({ ok: false });

    await expect(subscribeToPush(A_KEY)).resolves.toBe(false);
  });

  it('says it did not work when the server could not be reached', async () => {
    aBrowserThatCan();
    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(subscribeToPush(A_KEY)).resolves.toBe(false);
  });
});

describe('unsubscribeFromPush', () => {
  it('tells both the browser and the server, since either alone leaves a half-belief', async () => {
    aBrowserThatCan();

    await unsubscribeFromPush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/push',
      expect.objectContaining({ method: 'DELETE' }),
    );

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('does nothing where the browser cannot be woken', async () => {
    vi.stubGlobal('navigator', {});

    await unsubscribeFromPush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing where this browser was never subscribed', async () => {
    aBrowserThatCan();
    getSubscription.mockResolvedValue(null);

    await unsubscribeFromPush();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
