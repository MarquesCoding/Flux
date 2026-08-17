import { partyAllows, whoKeepsTime } from '@FluxContracts/schemas/WatchParty';
import type {
  PartyCommand,
  PartyMember,
  PartyRole,
  SequencedCommand,
  WatchParty,
} from '@FluxContracts/schemas/WatchParty';

type Joining = {
  partyId: string;
  connectionId: string;
  accountId: string;
  profileId: string | null;
  name: string;
};

type Issued =
  { kind: 'sent'; party: WatchParty; command: SequencedCommand } | { kind: 'refused'; why: string };

type PartyRegistry = {
  open: (options: { mediaId: string; host: Omit<Joining, 'partyId'> }) => WatchParty;
  join: (joining: Joining) => WatchParty | null;
  leave: (connectionId: string) => WatchParty | null;
  issue: (partyId: string, connectionId: string, command: PartyCommand, atMs: number) => Issued;
  report: (
    connectionId: string,
    where: { positionSeconds: number; bufferedAheadSeconds: number; isWatching: boolean },
  ) => WatchParty | null;
  setRole: (
    partyId: string,
    byConnectionId: string,
    ofConnectionId: string,
    role: PartyRole,
  ) => Issued;
  loosen: (
    partyId: string,
    byConnectionId: string,
    how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean },
  ) => Issued;
  find: (partyId: string) => WatchParty | null;
  partyOf: (connectionId: string) => WatchParty | null;
  count: () => number;
};

type Held = {
  party: WatchParty;
  sequence: number;
};

const REFUSED_UNKNOWN = 'That party is not running.';

const REFUSED_NOT_IN = 'You are not in that party.';

const REFUSED_NOT_ALLOWED = 'The host has not given you that.';

/**
 * Every watch party running, who is in each, and what each of them may do.
 *
 * Held in memory rather than in Postgres because a party is a conversation rather than a record: it
 * exists only while people are connected, and a party that survived a restart would be a room full
 * of nobody. It ends when the last person leaves rather than when a particular person does.
 *
 * Commands are stamped with a sequence here rather than at each client, so that two people pausing
 * at the same moment resolve identically everywhere instead of each client deciding for itself.
 *
 * What a party permits is decided here and nowhere else. A client hiding a button is presentation;
 * this refusing the command is the permission.
 *
 * @param newId - How a party identifier is minted.
 * @returns The registry.
 */
const createPartyRegistry = (newId: () => string): PartyRegistry => {
  const parties = new Map<string, Held>();
  const whereEveryoneIs = new Map<string, string>();

  const asMember = (
    joining: Omit<Joining, 'partyId'>,
    role: PartyRole,
    atMs: number,
  ): PartyMember => ({
    connectionId: joining.connectionId,
    accountId: joining.accountId,
    profileId: joining.profileId,
    name: joining.name,
    role,
    joinedAtMs: atMs,
    isWatching: false,
    positionSeconds: 0,
    bufferedAheadSeconds: 0,
  });

  const settleTimekeeper = (party: WatchParty): WatchParty => ({
    ...party,
    timekeeperId: whoKeepsTime(party.members),
  });

  const held = (partyId: string): Held | undefined => parties.get(partyId);

  const memberIn = (party: WatchParty, connectionId: string): PartyMember | undefined =>
    party.members.find((one) => one.connectionId === connectionId);

  const save = (party: WatchParty, sequence: number): WatchParty => {
    const settled = settleTimekeeper(party);

    parties.set(settled.id, { party: settled, sequence });

    return settled;
  };

  return {
    open: ({ mediaId, host }) => {
      const atMs = Date.now();

      const party: WatchParty = {
        id: newId(),
        mediaId,
        createdAtMs: atMs,
        everyoneMaySeek: true,
        everyoneMayPlayPause: true,
        members: [asMember(host, 'host', atMs)],
        timekeeperId: null,
      };

      whereEveryoneIs.set(host.connectionId, party.id);

      return save(party, 0);
    },

    join: (joining) => {
      const holding = held(joining.partyId);

      if (holding === undefined) {
        return null;
      }

      if (memberIn(holding.party, joining.connectionId) !== undefined) {
        return holding.party;
      }

      whereEveryoneIs.set(joining.connectionId, joining.partyId);

      return save(
        {
          ...holding.party,
          members: [...holding.party.members, asMember(joining, 'guest', Date.now())],
        },
        holding.sequence,
      );
    },

    leave: (connectionId) => {
      const partyId = whereEveryoneIs.get(connectionId);
      const holding = partyId === undefined ? undefined : held(partyId);

      whereEveryoneIs.delete(connectionId);

      if (holding === undefined || partyId === undefined) {
        return null;
      }

      const left = holding.party.members.filter((one) => one.connectionId !== connectionId);

      if (left.length === 0) {
        parties.delete(partyId);

        return null;
      }

      const stillHosted = left.some((one) => one.role === 'host');

      return save(
        {
          ...holding.party,
          members: stillHosted
            ? left
            : left.map((one, index) => (index === 0 ? { ...one, role: 'host' } : one)),
        },
        holding.sequence,
      );
    },

    issue: (partyId, connectionId, command, atMs) => {
      const holding = held(partyId);

      if (holding === undefined) {
        return { kind: 'refused', why: REFUSED_UNKNOWN };
      }

      const member = memberIn(holding.party, connectionId);

      if (member === undefined) {
        return { kind: 'refused', why: REFUSED_NOT_IN };
      }

      if (!partyAllows(holding.party, member.role, command)) {
        return { kind: 'refused', why: REFUSED_NOT_ALLOWED };
      }

      const sequence = holding.sequence + 1;

      const party =
        command.kind === 'changeWhatIsPlaying'
          ? save({ ...holding.party, mediaId: command.mediaId }, sequence)
          : save(holding.party, sequence);

      return {
        kind: 'sent',
        party,
        command: {
          sequence,
          atMs,
          byName: member.name,
          byConnectionId: connectionId,
          command,
        },
      };
    },

    report: (connectionId, where) => {
      const partyId = whereEveryoneIs.get(connectionId);
      const holding = partyId === undefined ? undefined : held(partyId);

      if (holding === undefined) {
        return null;
      }

      return save(
        {
          ...holding.party,
          members: holding.party.members.map((one) =>
            one.connectionId === connectionId ? { ...one, ...where } : one,
          ),
        },
        holding.sequence,
      );
    },

    setRole: (partyId, byConnectionId, ofConnectionId, role) => {
      const holding = held(partyId);

      if (holding === undefined) {
        return { kind: 'refused', why: REFUSED_UNKNOWN };
      }

      const actor = memberIn(holding.party, byConnectionId);

      if (actor === undefined) {
        return { kind: 'refused', why: REFUSED_NOT_IN };
      }

      if (actor.role !== 'host') {
        return { kind: 'refused', why: REFUSED_NOT_ALLOWED };
      }

      const party = save(
        {
          ...holding.party,
          members: holding.party.members.map((one) =>
            one.connectionId === ofConnectionId ? { ...one, role } : one,
          ),
        },
        holding.sequence,
      );

      return {
        kind: 'sent',
        party,
        command: {
          sequence: holding.sequence,
          atMs: Date.now(),
          byName: actor.name,
          byConnectionId,
          command: { kind: 'pause', atSeconds: 0 },
        },
      };
    },

    loosen: (partyId, byConnectionId, how) => {
      const holding = held(partyId);

      if (holding === undefined) {
        return { kind: 'refused', why: REFUSED_UNKNOWN };
      }

      const actor = memberIn(holding.party, byConnectionId);

      if (actor === undefined) {
        return { kind: 'refused', why: REFUSED_NOT_IN };
      }

      if (actor.role !== 'host') {
        return { kind: 'refused', why: REFUSED_NOT_ALLOWED };
      }

      const party = save(
        {
          ...holding.party,
          everyoneMaySeek: how.everyoneMaySeek ?? holding.party.everyoneMaySeek,
          everyoneMayPlayPause: how.everyoneMayPlayPause ?? holding.party.everyoneMayPlayPause,
        },
        holding.sequence,
      );

      return {
        kind: 'sent',
        party,
        command: {
          sequence: holding.sequence,
          atMs: Date.now(),
          byName: actor.name,
          byConnectionId,
          command: { kind: 'pause', atSeconds: 0 },
        },
      };
    },

    find: (partyId) => held(partyId)?.party ?? null,

    partyOf: (connectionId) => {
      const partyId = whereEveryoneIs.get(connectionId);

      return partyId === undefined ? null : (held(partyId)?.party ?? null);
    },

    count: () => parties.size,
  };
};

export type { PartyRegistry, Joining, Issued };

export { createPartyRegistry, REFUSED_NOT_ALLOWED, REFUSED_NOT_IN, REFUSED_UNKNOWN };
