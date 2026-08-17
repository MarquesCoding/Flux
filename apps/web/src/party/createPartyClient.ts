import {
  WatchPartySchema,
  SequencedCommandSchema,
  PartyNoticeSchema,
} from '@FluxContracts/schemas/WatchParty';
import { estimateClockOffset, measurementJitter } from '@FluxCore/functions/estimateClockOffset';
import { z } from 'zod';
import type { Reading } from '@FluxCore/functions/estimateClockOffset';
import type {
  PartyCommand,
  PartyNotice,
  SequencedCommand,
  WatchParty,
} from '@FluxContracts/schemas/WatchParty';
import type { RealtimeClient } from '@FluxWeb/realtime/createRealtimeClient';

const PartyEventSchema = z.object({
  party: WatchPartySchema,
  command: SequencedCommandSchema.optional(),
  notice: PartyNoticeSchema.optional(),
});

type PartyWatcher = {
  onParty: (party: WatchParty) => void;
  onCommand: (command: SequencedCommand) => void;
  onNotice: (notice: PartyNotice) => void;
};

type PartyClient = {
  open: (mediaId: string) => void;
  join: (partyId: string, password?: string) => void;
  leave: () => void;
  send: (command: PartyCommand) => void;
  report: (where: {
    positionSeconds: number;
    bufferedAheadSeconds: number;
    isWatching: boolean;
    isReady: boolean;
  }) => void;
  setRole: (connectionId: string, role: 'host' | 'coHost' | 'guest') => void;
  remove: (connectionId: string) => void;
  ask: (profileId: string) => void;
  setPassword: (password: string | null) => void;
  loosen: (how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean }) => void;
  offsetMs: () => number;
  jitterMs: () => number;
  watchClock: () => () => void;
  stop: () => void;
};

/**
 * This tab's side of a watch party, over the connection the rest of the app already has.
 *
 * Holds no authority of its own. Everything it sends is a request the server decides on, and
 * everything it shows is what the server last said the party is — a client that believed its own
 * commands would show a party that had diverged from everybody else's.
 *
 * The clock exchange runs only while there is a party to synchronise with, because positions from
 * different machines cannot be compared without it — and there is nothing to compare for a tab
 * watching alone. Wall clocks drift and are user-settable, so the offset is measured rather than
 * assumed.
 *
 * @param client - The shared socket.
 * @param watcher - Told when the party changes and when a command arrives.
 * @param schedule - How the clock exchange is repeated.
 * @param everyMs - How often to measure the clock.
 * @param now - This machine's clock.
 * @returns The party client.
 */
const createPartyClient = ({
  client,
  watcher,
  schedule,
  everyMs,
  now,
}: {
  client: RealtimeClient;
  watcher: PartyWatcher;
  schedule: (run: () => void, afterMs: number) => () => void;
  everyMs: number;
  now: () => number;
}): PartyClient => {
  const readings: Reading[] = [];
  let asked: number | null = null;
  let cancel: (() => void) | null = null;

  const release = client.subscribe('party', (event) => {
    const read = PartyEventSchema.safeParse(event.payload);

    if (!read.success) {
      return;
    }

    watcher.onParty(read.data.party);

    if (read.data.command !== undefined) {
      watcher.onCommand(read.data.command);
    }

    if (read.data.notice !== undefined) {
      watcher.onNotice(read.data.notice);
    }
  });

  const stopClock = client.onClockTell((sentAtMs, serverAtMs) => {
    if (asked !== null && sentAtMs === asked) {
      readings.push({ sentAtMs, serverAtMs, backAtMs: now() });
      asked = null;
    }
  });

  const askTheClock = () => {
    asked = now();
    client.askClock(asked);
    cancel = schedule(askTheClock, everyMs);
  };

  return {
    open: (mediaId) => {
      client.sendParty({ kind: 'partyOpen', mediaId });
    },

    join: (partyId, password) => {
      client.sendParty({
        kind: 'partyJoin',
        partyId,
        ...(password === undefined ? {} : { password }),
      });
    },

    leave: () => {
      client.sendParty({ kind: 'partyLeave' });
    },

    send: (command) => {
      client.sendParty({ kind: 'partyCommand', command });
    },

    report: (where) => {
      client.sendParty({ kind: 'partyReport', ...where });
    },

    setRole: (connectionId, role) => {
      client.sendParty({ kind: 'partySetRole', connectionId, role });
    },

    remove: (connectionId) => {
      client.sendParty({ kind: 'partyRemove', connectionId });
    },

    ask: (profileId) => {
      client.sendParty({ kind: 'partyInvite', profileId });
    },

    setPassword: (password) => {
      client.sendParty({ kind: 'partySetPassword', password });
    },

    loosen: (how) => {
      client.sendParty({ kind: 'partyLoosen', ...how });
    },

    watchClock: () => {
      askTheClock();

      return () => {
        cancel?.();
        cancel = null;
      };
    },

    offsetMs: () => estimateClockOffset(readings),

    jitterMs: () => measurementJitter(readings),

    stop: () => {
      cancel?.();
      cancel = null;
      release();
      stopClock();
    },
  };
};

export type { PartyClient, PartyWatcher };

export { createPartyClient };
