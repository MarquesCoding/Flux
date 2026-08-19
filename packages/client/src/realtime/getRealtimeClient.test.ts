import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Handlers, RealtimeClient } from './createRealtimeClient';

let listening: Handlers | null = null;

let opened = 0;

/**
 * Starts a run with nothing remembered, since the client is held in a module and one test's
 * connection would otherwise be the next one's.
 */
const startAfresh = async (): Promise<() => RealtimeClient> => {
  vi.resetModules();

  listening = null;
  opened = 0;

  const { installPlatform } = await import('@FluxClient/platform/installPlatform');
  const { aFakePlatform } = await import('@FluxClient/testing/aFakePlatform');

  installPlatform({
    ...aFakePlatform(),
    openSocket: (handlers) => {
      listening = handlers;
      opened += 1;

      return { send: () => {}, close: () => {} };
    },
  });

  return (await import('./getRealtimeClient')).getRealtimeClient;
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getRealtimeClient', () => {
  it('opens the connection through the client it is running on, rather than a socket of its own', async () => {
    const getRealtimeClient = await startAfresh();

    getRealtimeClient();

    expect(opened).toBe(1);
  });

  it('hands out the one connection, so a page cannot hold several at once', async () => {
    const getRealtimeClient = await startAfresh();

    expect(getRealtimeClient()).toBe(getRealtimeClient());
    expect(opened).toBe(1);
  });

  it('starts it, so the caller does not have to remember to', async () => {
    const getRealtimeClient = await startAfresh();

    const client = getRealtimeClient();

    expect(client.isLive()).toBe(false);

    listening?.onOpen();

    expect(client.isLive()).toBe(true);
  });

  it('waits before trying again when the connection drops', async () => {
    const getRealtimeClient = await startAfresh();

    getRealtimeClient();
    listening?.onClose();

    expect(opened).toBe(1);

    vi.runOnlyPendingTimers();

    expect(opened).toBe(2);
  });

  it('abandons a wait that is no longer wanted, rather than reconnecting after being stopped', async () => {
    const getRealtimeClient = await startAfresh();

    const client = getRealtimeClient();

    listening?.onClose();
    client.stop();
    vi.runOnlyPendingTimers();

    expect(opened).toBe(1);
  });
});
