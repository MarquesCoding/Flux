import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { rememberServerAddress, serverAddress } from '@FluxClient/session/serverAddress';
import { openRealtimeSocket, socketAddressOf } from './openRealtimeSocket';
import type { Handlers } from '@FluxClient/realtime/createRealtimeClient';

class FakeSocket {
  static last: FakeSocket | null = null;

  static readonly OPEN = 1;

  readyState = 1;

  sent: string[] = [];

  isClosed = false;

  onopen: (() => void) | null = null;

  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  onclose: (() => void) | null = null;

  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.last = this;
  }

  send(raw: string) {
    this.sent.push(raw);
  }

  close() {
    this.isClosed = true;
  }
}

const nothingListening = (): Handlers => ({
  onOpen: vi.fn(),
  onMessage: vi.fn(),
  onClose: vi.fn(),
});

const inMemory = () => {
  const held = new Map<string, string>();

  return {
    read: (key: string) => held.get(key) ?? null,
    write: (key: string, value: string) => {
      held.set(key, value);
    },
    forget: (key: string) => {
      held.delete(key);
    },
  };
};

beforeEach(() => {
  FakeSocket.last = null;

  vi.stubGlobal('WebSocket', FakeSocket);

  forgetPlatform();
  installPlatform({
    store: inMemory(),
    describeThisClient: () => 'Flux on a desktop',
    thisClientId: () => 'a-window',
    whereTheServerIs: () => serverAddress() ?? '',
    signInElsewhere: null,
    openSocket: openRealtimeSocket,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetPlatform();
});

describe('socketAddressOf', () => {
  it('opens a plain socket against a server reached without TLS', () => {
    expect(socketAddressOf('http://192.168.1.20:8420')).toBe(
      'ws://192.168.1.20:8420/api/realtime',
    );
  });

  it('opens a secure socket against a server reached over TLS, which refuses a plain one', () => {
    expect(socketAddressOf('https://flux.example.com')).toBe(
      'wss://flux.example.com/api/realtime',
    );
  });

  it('keeps a path, for a Flux served under one', () => {
    expect(socketAddressOf('https://example.com/flux')).toBe(
      'wss://example.com/flux/api/realtime',
    );
  });



});

describe('openRealtimeSocket', () => {
  it('refuses to open anything before somebody has said where their Flux is', () => {
    expect(() => openRealtimeSocket(nothingListening())).toThrow();
  });

  it('opens against the server this client was told to watch, not against itself', () => {
    rememberServerAddress('https://flux.example.com');

    openRealtimeSocket(nothingListening());

    expect(FakeSocket.last?.url).toBe('wss://flux.example.com/api/realtime');
  });


  it('passes on the moments the client cares about', () => {
    rememberServerAddress('https://flux.example.com');

    const handlers = nothingListening();

    openRealtimeSocket(handlers);

    FakeSocket.last?.onopen?.();
    FakeSocket.last?.onmessage?.(new MessageEvent('message', { data: 'a reading' }));
    FakeSocket.last?.onclose?.();

    expect(handlers.onOpen).toHaveBeenCalledOnce();
    expect(handlers.onMessage).toHaveBeenCalledWith('a reading');
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it('closes on an error, so the client is told and can try again', () => {
    rememberServerAddress('https://flux.example.com');

    openRealtimeSocket(nothingListening());

    FakeSocket.last?.onerror?.();

    expect(FakeSocket.last?.isClosed).toBe(true);
  });

  it('sends what it is given', () => {
    rememberServerAddress('https://flux.example.com');

    const link = openRealtimeSocket(nothingListening());

    link.send('hello');

    expect(FakeSocket.last?.sent).toEqual(['hello']);
  });

  it('drops what it is given before the connection is up, rather than throwing', () => {
    rememberServerAddress('https://flux.example.com');

    const link = openRealtimeSocket(nothingListening());

    const socket = FakeSocket.last;

    if (socket === null) {
      throw new Error('No socket was opened');
    }

    socket.readyState = 0;

    link.send('too early');

    expect(socket.sent).toEqual([]);
  });

  it('closes the connection when asked', () => {
    rememberServerAddress('https://flux.example.com');

    const link = openRealtimeSocket(nothingListening());

    link.close();

    expect(FakeSocket.last?.isClosed).toBe(true);
  });
});
