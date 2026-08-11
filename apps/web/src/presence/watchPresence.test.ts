import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchPresence } from './watchPresence';
import { onPresenceEvent } from './presenceEvents';
class FakeEventSource {
  static last: FakeEventSource | null = null;

  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  isClosed = false;

  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }

  close() {
    this.isClosed = true;
  }
}

beforeEach(() => {
  window.sessionStorage.clear();
  FakeEventSource.last = null;
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('watchPresence', () => {
  it('opens this tab’s own presence connection', () => {
    watchPresence();

    expect(FakeEventSource.last?.url).toContain('/api/presence/stream?');
    expect(FakeEventSource.last?.url).toContain('clientId=');
  });

  it('passes a stopped event on to anyone listening', () => {
    const listener = vi.fn();

    onPresenceEvent(listener);
    watchPresence();
    FakeEventSource.last?.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ kind: 'stopped', reason: 'This stream was stopped by an admin.' }),
      }),
    );

    expect(listener).toHaveBeenCalledWith({
      kind: 'stopped',
      reason: 'This stream was stopped by an admin.',
    });
  });

  it('ignores a message it cannot read, rather than throwing on the stream', () => {
    const listener = vi.fn();

    onPresenceEvent(listener);
    watchPresence();
    FakeEventSource.last?.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify({ kind: 'unknown' }) }),
    );

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops watching when it is told to', () => {
    const stop = watchPresence();

    stop();

    expect(FakeEventSource.last?.isClosed).toBe(true);
  });
});
