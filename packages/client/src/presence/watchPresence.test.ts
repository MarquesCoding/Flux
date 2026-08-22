import { beforeEach, describe, expect, it, vi } from 'vitest';
import { watchPresence } from './watchPresence';
import { onPresenceEvent } from './presenceEvents';
import type { RealtimeClient, Identity } from '@ValenceClient/realtime/createRealtimeClient';
import type { RealtimeEvent, RealtimeTopic } from '@ValenceContracts/schemas/Realtime';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';

const createFakeClient = () => {
  const listeners = new Map<RealtimeTopic, (event: RealtimeEvent) => void>();
  const identities: Identity[] = [];

  const client: RealtimeClient = {
    start: () => {},
    stop: () => {},
    subscribe: (topic, listen) => {
      listeners.set(topic, listen);

      return () => {
        listeners.delete(topic);
      };
    },
    identify: (who) => {
      identities.push(who);
    },
    onResumed: () => () => {},
    isLive: () => true,
    connectionId: () => null,
    sendParty: () => {},
    askClock: () => {},
    onClockTell: () => () => {},
    onRefused: () => () => {},
    onNeedsPassword: () => () => {},
  };

  return {
    client,
    identities,
    arrive: (payload: JsonValue) => {
      listeners.get('presence')?.({
        kind: 'event',
        topic: 'presence',
        atMs: 1,
        folded: 0,
        payload,
      });
    },
  };
};

beforeEach(() => {
  installPlatform(aFakePlatform());
});

describe('watchPresence', () => {
  it('tells the server which tab this is, so it appears in the sessions list', () => {
    const fake = createFakeClient();

    watchPresence(fake.client);

    expect(fake.identities[0]?.clientId).toBeDefined();
  });

  it('says what sort of device this is, for the list an operator reads', () => {
    const fake = createFakeClient();

    watchPresence(fake.client);

    expect(fake.identities[0]?.deviceLabel).toBeDefined();
  });

  it('passes a stopped event on to anyone listening', () => {
    const fake = createFakeClient();
    const listener = vi.fn();

    onPresenceEvent(listener);
    watchPresence(fake.client);
    fake.arrive({ kind: 'stopped', reason: 'This stream was stopped by an admin.' });

    expect(listener).toHaveBeenCalledWith({
      kind: 'stopped',
      reason: 'This stream was stopped by an admin.',
    });
  });

  it('passes a resume on, which carries no reason', () => {
    const fake = createFakeClient();
    const listener = vi.fn();

    onPresenceEvent(listener);
    watchPresence(fake.client);
    fake.arrive({ kind: 'resumed' });

    expect(listener).toHaveBeenCalledWith({ kind: 'resumed' });
  });

  it('ignores an event it cannot read, rather than throwing on the connection', () => {
    const fake = createFakeClient();
    const listener = vi.fn();

    onPresenceEvent(listener);
    watchPresence(fake.client);
    fake.arrive({ kind: 'unknown' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops listening when told to, leaving the socket for everything else', () => {
    const fake = createFakeClient();
    const listener = vi.fn();

    onPresenceEvent(listener);
    const stop = watchPresence(fake.client);

    stop();
    fake.arrive({ kind: 'stopped', reason: 'This stream was stopped by an admin.' });

    expect(listener).not.toHaveBeenCalled();
  });
});
