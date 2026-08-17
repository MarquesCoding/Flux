import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPartyClient } from './createPartyClient';
import { whereTheRoomIs } from '@FluxCore/functions/whereTheRoomIs';
import { whoIsHoldingUp } from '@FluxCore/functions/whoIsHoldingUp';
import { getRealtimeClient } from '@FluxWeb/realtime/getRealtimeClient';
import type { PartyClient } from './createPartyClient';
import type { PartyRole, SequencedCommand, WatchParty } from '@FluxContracts/schemas/WatchParty';
import type { RealtimeClient } from '@FluxWeb/realtime/createRealtimeClient';

const ASK_THE_CLOCK_EVERY_MS = 5000;

type PasswordWanted = {
  partyId: string;
  wasWrong: boolean;
};

type WatchPartyState = {
  party: WatchParty | null;
  command: SequencedCommand | null;
  refusal: string | null;
  notice: string | null;
  passwordWanted: PasswordWanted | null;
  meConnectionId: string | null;
  referenceSeconds: number | null;
  waitingFor: readonly string[];
  jitterMs: number;
  open: (mediaId: string) => void;
  join: (partyId: string, password?: string) => void;
  leave: () => void;
  send: PartyClient['send'];
  report: PartyClient['report'];
  setRole: (connectionId: string, role: PartyRole) => void;
  remove: (connectionId: string) => void;
  ask: (profileId: string) => void;
  setPassword: (password: string | null) => void;
  forgetNotice: () => void;
  stopAsking: () => void;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordWanted, setPasswordWanted] = useState<PasswordWanted | null>(null);
  const partyRef = useRef<PartyClient | null>(null);
  const inPartyRef = useRef<string | null>(null);

  useEffect(() => {
    const held = createPartyClient({
      client,
      watcher: {
        onParty: (told) => {
          setParty(told.members.length === 0 ? null : told);
        },
        onCommand: setCommand,
        onNotice: (told) => {
          setNotice(`${told.byName} removed you from the watch party.`);
        },
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

    const stopChallenges = client.onNeedsPassword((partyId, wasWrong) => {
      setPasswordWanted({ partyId, wasWrong });
    });

    return () => {
      held.stop();
      stopRefusals();
      stopChallenges();
      partyRef.current = null;
    };
  }, [client]);

  useEffect(() => {
    if (party === null) {
      return;
    }

    return partyRef.current?.watchClock();
  }, [party === null]);

  useEffect(() => {
    inPartyRef.current = party?.id ?? null;
  }, [party]);

  useEffect(
    () =>
      client.onResumed(() => {
        const rejoining = inPartyRef.current;

        if (rejoining !== null) {
          partyRef.current?.join(rejoining);
        }
      }),
    [client],
  );

  const meConnectionId = client.connectionId();

  const referenceSeconds = useMemo(() => {
    const timekeeper = party?.members.find((member) => member.connectionId === party.timekeeperId);

    return timekeeper === undefined || timekeeper.connectionId === meConnectionId
      ? null
      : whereTheRoomIs(timekeeper, Date.now() + (partyRef.current?.offsetMs() ?? 0));
  }, [party, meConnectionId]);

  const waitingFor = useMemo(
    () =>
      party === null
        ? []
        : whoIsHoldingUp(
            party.members,
            party.timekeeperId,
            Date.now() + (partyRef.current?.offsetMs() ?? 0),
          ).map((member) => member.name),
    [party],
  );

  const open = useCallback((mediaId: string) => {
    partyRef.current?.open(mediaId);
  }, []);

  const join = useCallback((partyId: string, password?: string) => {
    setPasswordWanted(null);
    partyRef.current?.join(partyId, password);
  }, []);

  const leave = useCallback(() => {
    inPartyRef.current = null;
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

  const remove = useCallback((connectionId: string) => {
    partyRef.current?.remove(connectionId);
  }, []);

  const ask = useCallback((profileId: string) => {
    partyRef.current?.ask(profileId);
  }, []);

  const setPassword = useCallback((password: string | null) => {
    partyRef.current?.setPassword(password);
  }, []);

  const forgetNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const stopAsking = useCallback(() => {
    setPasswordWanted(null);
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
    notice,
    passwordWanted,
    meConnectionId,
    referenceSeconds,
    waitingFor,
    jitterMs: partyRef.current?.jitterMs() ?? 0,
    open,
    join,
    leave,
    send,
    report,
    setRole,
    remove,
    ask,
    setPassword,
    forgetNotice,
    stopAsking,
    loosen,
  };
};

export type { WatchPartyState };

export { useWatchParty, ASK_THE_CLOCK_EVERY_MS };
