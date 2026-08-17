import { z } from 'zod';

const PARTY_ROLES = ['host', 'coHost', 'guest'] as const;

const PARTY_POWERS = ['playPause', 'seek', 'changeWhatIsPlaying', 'invite', 'manageParty'] as const;

const PartyRoleSchema = z.enum(PARTY_ROLES);

const PartyPowerSchema = z.enum(PARTY_POWERS);

type PartyRole = (typeof PARTY_ROLES)[number];
type PartyPower = (typeof PARTY_POWERS)[number];

const POWERS_BY_ROLE: Readonly<Record<PartyRole, readonly PartyPower[]>> = {
  host: ['playPause', 'seek', 'changeWhatIsPlaying', 'invite', 'manageParty'],
  coHost: ['playPause', 'seek', 'changeWhatIsPlaying', 'invite'],
  guest: [],
};

const PartyMemberSchema = z.object({
  connectionId: z.string().min(1),
  accountId: z.string().min(1),
  profileId: z.string().nullable(),
  name: z.string().min(1),
  role: PartyRoleSchema,
  joinedAtMs: z.number().int().nonnegative(),
  isWatching: z.boolean(),
  isReady: z.boolean(),
  positionSeconds: z.number().nonnegative(),
  reportedAtMs: z.number().int().nonnegative(),
  bufferedAheadSeconds: z.number().nonnegative(),
});

const WatchPartySchema = z.object({
  id: z.string().min(1),
  mediaId: z.string().min(1),
  createdAtMs: z.number().int().nonnegative(),
  everyoneMaySeek: z.boolean(),
  everyoneMayPlayPause: z.boolean(),
  hasPassword: z.boolean(),
  isPlaying: z.boolean(),
  isHeld: z.boolean(),
  members: z.array(PartyMemberSchema),
  timekeeperId: z.string().nullable(),
});

const PartyCommandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('play'), atSeconds: z.number().nonnegative() }),
  z.object({ kind: z.literal('pause'), atSeconds: z.number().nonnegative() }),
  z.object({ kind: z.literal('seek'), atSeconds: z.number().nonnegative() }),
  z.object({ kind: z.literal('changeWhatIsPlaying'), mediaId: z.string().min(1) }),
]);

const PartyNoticeSchema = z.object({
  kind: z.literal('removed'),
  byName: z.string().min(1),
});

const SequencedCommandSchema = z.object({
  sequence: z.number().int().nonnegative(),
  atMs: z.number().int().nonnegative(),
  byName: z.string().min(1),
  byConnectionId: z.string().min(1),
  command: PartyCommandSchema,
});

type PartyMember = z.infer<typeof PartyMemberSchema>;
type WatchParty = z.infer<typeof WatchPartySchema>;
type PartyCommand = z.infer<typeof PartyCommandSchema>;
type SequencedCommand = z.infer<typeof SequencedCommandSchema>;
type PartyNotice = z.infer<typeof PartyNoticeSchema>;

const POWER_BY_COMMAND: Readonly<Record<PartyCommand['kind'], PartyPower>> = {
  play: 'playPause',
  pause: 'playPause',
  seek: 'seek',
  changeWhatIsPlaying: 'changeWhatIsPlaying',
};

/**
 * What a role may do inside a party, before the party's own loosening is applied.
 *
 * @param role - The role held.
 * @returns The powers it carries.
 */
const powersOf = (role: PartyRole): readonly PartyPower[] => POWERS_BY_ROLE[role];

/**
 * Which power a command needs, so that adding a command without deciding who may issue it is a type
 * error rather than a command anybody can send.
 *
 * @param command - The command being issued.
 * @returns The power it requires.
 */
const powerForCommand = (command: PartyCommand): PartyPower => POWER_BY_COMMAND[command.kind];

/**
 * Whether somebody in a party may issue a command.
 *
 * Everyone can play, pause and seek by default, because that is right among friends and is what
 * most parties should never need to change. The creator can tighten it, since they are the only one
 * who knows whether this is three friends or a dozen people off a forwarded link.
 *
 * This answers only what the *party* allows. It can restrict and never grant: whether the account
 * may watch the thing at all is settled before any of this, and a party role is not a way to reach
 * something an account could not already see.
 *
 * @param party - What the party permits.
 * @param role - The role the member holds.
 * @param command - What they are trying to do.
 * @returns Whether the party allows it.
 */
const partyAllows = (
  party: { everyoneMaySeek: boolean; everyoneMayPlayPause: boolean },
  role: PartyRole,
  command: PartyCommand,
): boolean => {
  const needed = powerForCommand(command);

  if (powersOf(role).includes(needed)) {
    return true;
  }

  if (needed === 'seek') {
    return party.everyoneMaySeek;
  }

  return needed === 'playPause' && party.everyoneMayPlayPause;
};

/**
 * Who keeps the time once the party has lost whoever was doing it.
 *
 * Chosen by longest-connected rather than negotiated, so every client works out the same answer
 * without asking. Losing the timekeeper costs the party no authority — control is shared, so
 * everybody still has what they had — it costs only the reference that drift is measured against,
 * which is why it can pass quietly.
 *
 * @param members - Everybody in the party.
 * @returns Who should keep the time, or null where nobody is left.
 */
const whoKeepsTime = (members: readonly PartyMember[]): string | null =>
  [...members].sort((one, other) =>
    one.joinedAtMs === other.joinedAtMs
      ? one.connectionId.localeCompare(other.connectionId)
      : one.joinedAtMs - other.joinedAtMs,
  )[0]?.connectionId ?? null;

export type {
  PartyRole,
  PartyPower,
  PartyMember,
  WatchParty,
  PartyCommand,
  SequencedCommand,
  PartyNotice,
};

export {
  PARTY_ROLES,
  PARTY_POWERS,
  PartyRoleSchema,
  PartyPowerSchema,
  PartyMemberSchema,
  WatchPartySchema,
  PartyCommandSchema,
  SequencedCommandSchema,
  PartyNoticeSchema,
  powersOf,
  powerForCommand,
  partyAllows,
  whoKeepsTime,
};
