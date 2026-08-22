import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openRealtimeSocket } from './openRealtimeSocket';
import type { Handlers } from '@ValenceClient/realtime/createRealtimeClient';

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

const servedFrom = (protocol: string, host: string): void => {
  vi.stubGlobal('location', { protocol, host });
};

beforeEach(() => {
  FakeSocket.last = null;

  vi.stubGlobal('WebSocket', FakeSocket);
  servedFrom('http:', 'localhost:5173');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openRealtimeSocket', () => {
  it('reaches the realtime path on the host the page came from', () => {
    openRealtimeSocket(nothingListening());

    expect(FakeSocket.last?.url).toBe('ws://localhost:5173/api/realtime');
  });

  it('follows the page onto TLS, rather than being fixed to one scheme', () => {
    servedFrom('https:', 'flux.example.com');

    openRealtimeSocket(nothingListening());

    expect(FakeSocket.last?.url).toBe('wss://flux.example.com/api/realtime');
  });

  it('passes on the moments the client cares about', () => {
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
    const handlers = nothingListening();

    openRealtimeSocket(handlers);

    FakeSocket.last?.onerror?.();

    expect(FakeSocket.last?.isClosed).toBe(true);
  });

  it('sends what it is given', () => {
    const link = openRealtimeSocket(nothingListening());

    link.send('hello');

    expect(FakeSocket.last?.sent).toEqual(['hello']);
  });

  it('drops what it is given before the connection is up, rather than throwing', () => {
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
    const link = openRealtimeSocket(nothingListening());

    link.close();

    expect(FakeSocket.last?.isClosed).toBe(true);
  });
});
