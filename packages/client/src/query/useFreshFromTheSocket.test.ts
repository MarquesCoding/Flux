import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { useFreshFromTheSocket } from './useFreshFromTheSocket';
import type { RealtimeEvent, RealtimeTopic } from '@FluxContracts/schemas/Realtime';
import type { ReactNode } from 'react';

const getRealtimeClient = vi.hoisted(() => vi.fn());

vi.mock('@FluxClient/realtime/getRealtimeClient', () => ({ getRealtimeClient }));

/**
 * A socket that says nothing until a test says it did, and remembers what it was asked to stop
 * listening to.
 */
const aSocket = () => {
  const listeners = new Map<string, (event: RealtimeEvent) => void>();
  const stopped: string[] = [];
  let onResume = (): void => undefined;

  return {
    stopped,
    say: (topic: string, event: RealtimeEvent) => {
      listeners.get(topic)?.(event);
    },
    reconnect: () => {
      onResume();
    },
    client: {
      subscribe: (topic: RealtimeTopic, listen: (event: RealtimeEvent) => void) => {
        listeners.set(topic, listen);

        return () => {
          stopped.push(topic);
        };
      },
      onResumed: (run: () => void) => {
        onResume = run;

        return () => {
          stopped.push('resumed');
        };
      },
    },
  };
};

const ANYTHING: RealtimeEvent = {
  kind: 'event',
  topic: 'media',
  atMs: 0,
  folded: 0,
  payload: null,
};

let cache: QueryClient;

const listening = (socket: ReturnType<typeof aSocket>) =>
  renderHook(
    () => {
      useFreshFromTheSocket(socket.client);
    },
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: cache }, children),
    },
  );

beforeEach(() => {
  cache = new QueryClient();
  getRealtimeClient.mockReturnValue(undefined);
});

describe('useFreshFromTheSocket', () => {
  it('throws away the library when the server says the media changed', () => {
    const invalidate = vi.spyOn(cache, 'invalidateQueries').mockResolvedValue(undefined);
    const socket = aSocket();

    listening(socket);
    socket.say('media', ANYTHING);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library'] });
  });

  it('throws away the inbox, the session and the admin page for their own news', () => {
    const invalidate = vi.spyOn(cache, 'invalidateQueries').mockResolvedValue(undefined);
    const socket = aSocket();

    listening(socket);
    socket.say('notifications', ANYTHING);
    socket.say('profile', ANYTHING);
    socket.say('sessions', ANYTHING);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['session'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin'] });
  });

  it('throws away everything after a reconnection, since it missed whatever happened', () => {
    const invalidate = vi.spyOn(cache, 'invalidateQueries').mockResolvedValue(undefined);
    const socket = aSocket();

    listening(socket);
    socket.reconnect();

    expect(invalidate).toHaveBeenCalledWith();
  });

  it('stops listening once it is gone', () => {
    const socket = aSocket();

    listening(socket).unmount();

    expect(socket.stopped).toEqual(['media', 'notifications', 'profile', 'sessions', 'resumed']);
  });

  it('asks for the shared socket when it is not given one', () => {
    getRealtimeClient.mockReturnValue(aSocket().client);

    renderHook(
      () => {
        useFreshFromTheSocket();
      },
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client: cache }, children),
      },
    );

    expect(getRealtimeClient).toHaveBeenCalled();
  });
});
