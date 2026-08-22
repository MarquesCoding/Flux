import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import type { FromClient, FromServer } from '@ValenceContracts/schemas/Realtime';
import type {
  PartyNotice,
  SequencedCommand,
  WatchParty,
} from '@ValenceContracts/schemas/WatchParty';
import type { PartyRegistry } from './createPartyRegistry';

type PartySpeaker = {
  connectionId: string;
  accountId: string;
  profileId: string | null;
  name: string;
};

type PartyBinding = {
  registry: PartyRegistry;
  tell: (connectionIds: readonly string[], payload: JsonValue) => void;
  ask?: (asking: { party: WatchParty; byName: string; profileId: string }) => void;
};

const asCommandJson = (command: SequencedCommand): JsonValue => ({
  sequence: command.sequence,
  atMs: command.atMs,
  byName: command.byName,
  byConnectionId: command.byConnectionId,
  command:
    command.command.kind === 'changeWhatIsPlaying'
      ? { kind: command.command.kind, mediaId: command.command.mediaId }
      : { kind: command.command.kind, atSeconds: command.command.atSeconds },
});

/**
 * A party as plain JSON, for sending down the socket.
 *
 * Written out field by field rather than handed over whole, so a field added to the party later has
 * to be considered here before it reaches everybody in it.
 *
 * @param party - The party being sent.
 * @param command - What just happened, where something did.
 * @param notice - Something worth telling this one person, where there is something.
 * @returns The party as JSON.
 */
const asPartyJson = (
  party: WatchParty,
  command?: SequencedCommand,
  notice?: PartyNotice,
): JsonValue => ({
  party: {
    id: party.id,
    mediaId: party.mediaId,
    createdAtMs: party.createdAtMs,
    everyoneMaySeek: party.everyoneMaySeek,
    everyoneMayPlayPause: party.everyoneMayPlayPause,
    hasPassword: party.hasPassword,
    isPlaying: party.isPlaying,
    isHeld: party.isHeld,
    timekeeperId: party.timekeeperId,
    members: party.members.map((member) => ({
      connectionId: member.connectionId,
      accountId: member.accountId,
      profileId: member.profileId,
      name: member.name,
      role: member.role,
      joinedAtMs: member.joinedAtMs,
      isWatching: member.isWatching,
      isReady: member.isReady,
      positionSeconds: member.positionSeconds,
      reportedAtMs: member.reportedAtMs,
      bufferedAheadSeconds: member.bufferedAheadSeconds,
    })),
  },
  ...(command === undefined ? {} : { command: asCommandJson(command) }),
  ...(notice === undefined ? {} : { notice: { kind: notice.kind, byName: notice.byName } }),
});

const tellEveryone = (
  binding: PartyBinding,
  party: WatchParty | null,
  command?: SequencedCommand,
): void => {
  if (party !== null) {
    binding.tell(
      party.members.map((member) => member.connectionId),
      asPartyJson(party, command),
    );
  }
};

/**
 * Answers everything a client says about a watch party.
 *
 * Every decision is taken here rather than believed from the client: whether a party exists, whether
 * somebody is in it, and whether they may do what they are asking. A client hiding a button is
 * presentation — this refusing the message is the permission, and it is the only one that counts.
 *
 * A refusal is answered rather than ignored, so somebody pressing a button that does nothing is told
 * why instead of being left tapping at it.
 *
 * @param message - What the client sent.
 * @param who - Who is speaking, as the server knows them rather than as they claim.
 * @param write - How to answer this one client.
 * @param binding - The party registry, how to reach everybody in a party, and how to ask somebody outside it to come.
 * @param now - The clock.
 */
const handlePartyMessage = (
  message: FromClient,
  who: PartySpeaker,
  write: (answer: FromServer) => void,
  binding: PartyBinding,
  now: () => number,
): void => {
  const { registry } = binding;

  if (message.kind === 'partyOpen') {
    tellEveryone(binding, registry.open({ mediaId: message.mediaId, host: who }));

    return;
  }

  if (message.kind === 'partyJoin') {
    const joined = registry.join({
      partyId: message.partyId,
      ...who,
      ...(message.password === undefined ? {} : { password: message.password }),
    });

    if (joined.kind === 'unknown') {
      write({ kind: 'refused', why: 'That party is not running.' });

      return;
    }

    if (joined.kind === 'notWelcome') {
      write({ kind: 'refused', why: 'The host has removed you from that party.' });

      return;
    }

    if (joined.kind === 'needsPassword') {
      write({
        kind: 'partyNeedsPassword',
        partyId: message.partyId,
        wasWrong: joined.wasWrong,
      });

      return;
    }

    tellEveryone(binding, joined.party);

    return;
  }

  if (message.kind === 'partyLeave') {
    const left = registry.leave(who.connectionId);

    tellEveryone(binding, left);
    write({ kind: 'refused', why: 'You have left the party.' });

    return;
  }

  const mine = registry.partyOf(who.connectionId);

  if (mine === null) {
    write({ kind: 'refused', why: 'You are not in a party.' });

    return;
  }

  if (message.kind === 'partyReport') {
    tellEveryone(
      binding,
      registry.report(who.connectionId, {
        positionSeconds: message.positionSeconds,
        bufferedAheadSeconds: message.bufferedAheadSeconds,
        isWatching: message.isWatching,
        isReady: message.isReady,
      }),
    );

    return;
  }

  if (message.kind === 'partyInvite') {
    const asking = registry.askToJoin(mine.id, who.connectionId);

    if (asking.kind === 'refused') {
      write({ kind: 'refused', why: asking.why });

      return;
    }

    binding.ask?.({
      party: asking.party,
      byName: asking.byName,
      profileId: message.profileId,
    });

    return;
  }

  if (message.kind === 'partyRemove') {
    const gone = registry.remove(mine.id, who.connectionId, message.connectionId);

    if (gone.kind === 'refused') {
      write({ kind: 'refused', why: gone.why });

      return;
    }

    binding.tell(
      [gone.connectionId],
      asPartyJson({ ...mine, members: [] }, undefined, {
        kind: 'removed',
        byName: gone.byName,
      }),
    );
    tellEveryone(binding, gone.party);

    return;
  }

  const done =
    message.kind === 'partyCommand'
      ? registry.issue(mine.id, who.connectionId, message.command, now())
      : message.kind === 'partySetRole'
        ? registry.setRole(mine.id, who.connectionId, message.connectionId, message.role)
        : message.kind === 'partySetPassword'
          ? registry.setPassword(mine.id, who.connectionId, message.password)
          : message.kind === 'partyLoosen'
            ? registry.loosen(mine.id, who.connectionId, {
                ...(message.everyoneMaySeek === undefined
                  ? {}
                  : { everyoneMaySeek: message.everyoneMaySeek }),
                ...(message.everyoneMayPlayPause === undefined
                  ? {}
                  : { everyoneMayPlayPause: message.everyoneMayPlayPause }),
              })
            : null;

  if (done === null) {
    return;
  }

  if (done.kind === 'refused') {
    write({ kind: 'refused', why: done.why });

    return;
  }

  tellEveryone(binding, done.party, message.kind === 'partyCommand' ? done.command : undefined);
};

export type { PartySpeaker, PartyBinding };

export { handlePartyMessage, asPartyJson, tellEveryone };
