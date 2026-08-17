import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPartyClient } from './createPartyClient';
import { getRealtimeClient } from '@FluxWeb/realtime/getRealtimeClient';
import type { PartyClient } from './createPartyClient';
import type { PartyRole, SequencedCommand, WatchParty } from '@FluxContracts/schemas/WatchParty';
import type { RealtimeClient } from '@FluxWeb/realtime/createRealtimeClient';

const ASK_THE_CLOCK_EVERY_MS = 5000;

type WatchPartyState = {
  party: WatchParty | null;
  command: SequencedCommand | null;
  refusal: string | null;
  meConnectionId: string | null;
  referenceSeconds: number | null;
  jitterMs: number;
  open: (mediaId: string) => void;
  join: (partyId: string) => void;
  leave: () => void;
  send: PartyClient['send'];
  report: PartyClient['report'];
  setRole: (connectionId: string, role: PartyRole) => void;
  loosen: (how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean }) => void;
};

/**
 * Holds this tab's watch party, if it is in one.
 *
 * The party is whatever the server last said it is, never what this tab believes it should be —
 * a client that applied its own commands optimistically would drift out of agreement with everybody
 * else the moment one was refused.
 *
 * @param client - The shared socket, injectable for tests.
 * @returns The party and the ways of acting on it.
 */
const useWatchParty = (client: RealtimeClient = getRealtimeClient()): WatchPartyState => {
  const [party, setParty] = useState<WatchParty | null>(null);
  const [command, setCommand] = useState<SequencedCommand | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const partyRef = useRef<PartyClient | null>(null);

  useEffect(() => {
    const held = createPartyClient({
      client,
      watcher: {
        onParty: setParty,
        onCommand: setCommand,
      },
      schedule: (run, afterMs) => {
        const timer = setTimeout(run, afterMs);

        return () => {
          clearTimeout(timer);
        };
      },
      everyMs: ASK_THE_CLOCK_EVERY_MS,
      now: () => Date.now(),
    });

    partyRef.current = held;

    const stopRefusals = client.onRefused(setRefusal);

    return () => {
      held.stop();
      stopRefusals();
      partyRef.current = null;
    };
  }, [client]);

  useEffect(() => {
    if (party === null) {
      return;
    }

    return partyRef.current?.watchClock();
  }, [party === null]);

  const meConnectionId = client.connectionId();

  const referenceSeconds = useMemo(() => {
    const timekeeper = party?.members.find((member) => member.connectionId === party.timekeeperId);

    return timekeeper === undefined || timekeeper.connectionId === meConnectionId
      ? null
      : timekeeper.positionSeconds;
  }, [party, meConnectionId]);

  const open = useCallback((mediaId: string) => {
    partyRef.current?.open(mediaId);
  }, []);

  const join = useCallback((partyId: string) => {
    partyRef.current?.join(partyId);
  }, []);

  const leave = useCallback(() => {
    partyRef.current?.leave();
    setParty(null);
    setCommand(null);
  }, []);

  const send = useCallback<PartyClient['send']>((next) => {
    partyRef.current?.send(next);
  }, []);

  const report = useCallback<PartyClient['report']>((where) => {
    partyRef.current?.report(where);
  }, []);

  const setRole = useCallback((connectionId: string, role: PartyRole) => {
    partyRef.current?.setRole(connectionId, role);
  }, []);

  const loosen = useCallback(
    (how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean }) => {
      partyRef.current?.loosen(how);
    },
    [],
  );

  return {
    party,
    command,
    refusal,
    meConnectionId,
    referenceSeconds,
    jitterMs: partyRef.current?.jitterMs() ?? 0,
    open,
    join,
    leave,
    send,
    report,
    setRole,
    loosen,
  };
};

export type { WatchPartyState };

export { useWatchParty, ASK_THE_CLOCK_EVERY_MS };
