import { partyAllows, powersOf, whoKeepsTime } from '@FluxContracts/schemas/WatchParty';
import { whoIsHoldingUp } from '@FluxCore/functions/whoIsHoldingUp';
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
  password?: string;
};

type Joined =
  | { kind: 'joined'; party: WatchParty }
  | { kind: 'needsPassword'; wasWrong: boolean }
  | { kind: 'notWelcome' }
  | { kind: 'unknown' };

type Issued =
  | { kind: 'sent'; party: WatchParty; command?: SequencedCommand }
  | { kind: 'refused'; why: string };

type PartyRegistry = {
  open: (options: { mediaId: string; host: Omit<Joining, 'partyId'> }) => WatchParty;
  join: (joining: Joining) => Joined;
  leave: (connectionId: string) => WatchParty | null;
  issue: (partyId: string, connectionId: string, command: PartyCommand, atMs: number) => Issued;
  report: (
    connectionId: string,
    where: {
      positionSeconds: number;
      bufferedAheadSeconds: number;
      isWatching: boolean;
      isReady: boolean;
    },
  ) => WatchParty | null;
  setRole: (
    partyId: string,
    byConnectionId: string,
    ofConnectionId: string,
    role: PartyRole,
  ) => Issued;
  remove: (partyId: string, byConnectionId: string, ofConnectionId: string) => Removed;
  askToJoin: (partyId: string, byConnectionId: string) => Asking;
  setPassword: (partyId: string, byConnectionId: string, password: string | null) => Issued;
  loosen: (
    partyId: string,
    byConnectionId: string,
    how: { everyoneMaySeek?: boolean; everyoneMayPlayPause?: boolean },
  ) => Issued;
  find: (partyId: string) => WatchParty | null;
  partyOf: (connectionId: string) => WatchParty | null;
  count: () => number;
};

type Asking = { kind: 'may'; party: WatchParty; byName: string } | { kind: 'refused'; why: string };

type Removed =
  | { kind: 'removed'; party: WatchParty | null; connectionId: string; byName: string }
  | { kind: 'refused'; why: string };

type Held = {
  party: WatchParty;
  sequence: number;
  password: string | null;
  notWelcome: Set<string>;
  heldSinceMs: number | null;
};

const WAIT_MOST_MS = 20_000;

const REFUSED_UNKNOWN = 'That party is not running.';

const REFUSED_NOT_IN = 'You are not in that party.';

const REFUSED_NOT_ALLOWED = 'The host has not given you that.';

const REFUSED_ONESELF = 'You cannot remove yourself from a party you can simply leave.';

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
 * A party's password is held here and never put in the party that goes out over the socket — what
 * everybody is told is only that there is one. Somebody the host has removed is remembered by
 * account rather than by connection, since a connection is discarded by opening the link again.
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
    isReady: false,
    positionSeconds: 0,
    reportedAtMs: atMs,
    bufferedAheadSeconds: 0,
  });

  const settleTimekeeper = (party: WatchParty): WatchParty => ({
    ...party,
    timekeeperId: whoKeepsTime(party.members),
  });

  const held = (partyId: string): Held | undefined => parties.get(partyId);

  const memberIn = (party: WatchParty, connectionId: string): PartyMember | undefined =>
    party.members.find((one) => one.connectionId === connectionId);

  const save = (party: WatchParty, sequence: number, was?: Held): WatchParty => {
    const atMs = Date.now();
    const settled = settleTimekeeper(party);
    const waitingFor = whoIsHoldingUp(settled.members, settled.timekeeperId, atMs);

    const heldSinceMs = waitingFor.length === 0 ? null : (was?.heldSinceMs ?? atMs);

    const isHeld =
      waitingFor.length > 0 && heldSinceMs !== null && atMs - heldSinceMs < WAIT_MOST_MS;

    const held = { ...settled, isHeld };

    parties.set(held.id, {
      party: held,
      sequence,
      password: was?.password ?? null,
      notWelcome: was?.notWelcome ?? new Set<string>(),
      heldSinceMs,
    });

    return held;
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
        hasPassword: false,
        isPlaying: true,
        isHeld: false,
        members: [asMember(host, 'host', atMs)],
        timekeeperId: null,
      };

      whereEveryoneIs.set(host.connectionId, party.id);

      return save(party, 0);
    },

    join: (joining) => {
      const holding = held(joining.partyId);

      if (holding === undefined) {
        return { kind: 'unknown' };
      }

      if (memberIn(holding.party, joining.connectionId) !== undefined) {
        return { kind: 'joined', party: holding.party };
      }

      if (holding.notWelcome.has(joining.accountId)) {
        return { kind: 'notWelcome' };
      }

      const alreadyIn = holding.party.members.some((one) => one.accountId === joining.accountId);

      if (holding.password !== null && !alreadyIn && joining.password !== holding.password) {
        return { kind: 'needsPassword', wasWrong: joining.password !== undefined };
      }

      whereEveryoneIs.set(joining.connectionId, joining.partyId);

      return {
        kind: 'joined',
        party: save(
          {
            ...holding.party,
            members: [...holding.party.members, asMember(joining, 'guest', Date.now())],
          },
          holding.sequence,
          holding,
        ),
      };
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
        holding,
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

      const intended =
        command.kind === 'play' || command.kind === 'pause'
          ? { ...holding.party, isPlaying: command.kind === 'play' }
          : holding.party;

      const party =
        command.kind === 'changeWhatIsPlaying'
          ? save({ ...intended, mediaId: command.mediaId }, sequence, holding)
          : save(intended, sequence, holding);

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
            one.connectionId === connectionId
              ? { ...one, ...where, reportedAtMs: Date.now() }
              : one,
          ),
        },
        holding.sequence,
        holding,
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
        holding,
      );

      return { kind: 'sent', party };
    },

    remove: (partyId, byConnectionId, ofConnectionId) => {
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

      if (byConnectionId === ofConnectionId) {
        return { kind: 'refused', why: REFUSED_ONESELF };
      }

      const going = memberIn(holding.party, ofConnectionId);

      if (going === undefined) {
        return { kind: 'refused', why: REFUSED_NOT_IN };
      }

      holding.notWelcome.add(going.accountId);
      whereEveryoneIs.delete(ofConnectionId);

      const left = holding.party.members.filter((one) => one.connectionId !== ofConnectionId);

      if (left.length === 0) {
        parties.delete(partyId);

        return { kind: 'removed', party: null, connectionId: ofConnectionId, byName: actor.name };
      }

      return {
        kind: 'removed',
        party: save({ ...holding.party, members: left }, holding.sequence, holding),
        connectionId: ofConnectionId,
        byName: actor.name,
      };
    },

    askToJoin: (partyId, byConnectionId) => {
      const holding = held(partyId);

      if (holding === undefined) {
        return { kind: 'refused', why: REFUSED_UNKNOWN };
      }

      const actor = memberIn(holding.party, byConnectionId);

      if (actor === undefined) {
        return { kind: 'refused', why: REFUSED_NOT_IN };
      }

      if (!powersOf(actor.role).includes('invite')) {
        return { kind: 'refused', why: REFUSED_NOT_ALLOWED };
      }

      return { kind: 'may', party: holding.party, byName: actor.name };
    },

    setPassword: (partyId, byConnectionId, password) => {
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

      holding.password = password;

      return {
        kind: 'sent',
        party: save(
          { ...holding.party, hasPassword: password !== null },
          holding.sequence,
          holding,
        ),
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
        holding,
      );

      return { kind: 'sent', party };
    },

    find: (partyId) => held(partyId)?.party ?? null,

    partyOf: (connectionId) => {
      const partyId = whereEveryoneIs.get(connectionId);

      return partyId === undefined ? null : (held(partyId)?.party ?? null);
    },

    count: () => parties.size,
  };
};

export type { PartyRegistry, Joining, Issued, Joined, Removed, Asking };

export {
  createPartyRegistry,
  REFUSED_NOT_ALLOWED,
  REFUSED_NOT_IN,
  REFUSED_ONESELF,
  REFUSED_UNKNOWN,
};
