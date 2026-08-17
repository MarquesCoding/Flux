import { z } from 'zod';
import { JsonValueSchema } from './JsonValue';
import { PartyCommandSchema, PartyRoleSchema } from './WatchParty';
import type { Permission } from './Permission';

const VIEWER_TOPICS = [
  'media',
  'notifications',
  'profile',
  'presence',
  'playback',
  'party',
] as const;

const ADMIN_TOPICS = ['monitor', 'sessions', 'logs'] as const;

const REALTIME_TOPICS = [...VIEWER_TOPICS, ...ADMIN_TOPICS] as const;

const RealtimeTopicSchema = z.enum(REALTIME_TOPICS);

type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

const PERMISSION_BY_TOPIC: Readonly<Record<RealtimeTopic, Permission | null>> = {
  media: null,
  party: null,
  notifications: null,
  profile: null,
  presence: null,
  playback: null,
  monitor: 'server.monitor',
  sessions: 'streaming.view',
  logs: 'server.logs',
};

const TopicListSchema = z.array(RealtimeTopicSchema).min(1).max(REALTIME_TOPICS.length);

const SubscribeSchema = z.object({ kind: z.literal('subscribe'), topics: TopicListSchema });

const UnsubscribeSchema = z.object({ kind: z.literal('unsubscribe'), topics: TopicListSchema });

const IdentifySchema = z.object({
  kind: z.literal('identify'),
  profileId: z.string().uuid().nullable(),
  clientId: z.string().min(1).max(120).optional(),
  deviceLabel: z.string().min(1).max(120).optional(),
});

const PongSchema = z.object({ kind: z.literal('pong') });

const ClockAskSchema = z.object({ kind: z.literal('clockAsk'), sentAtMs: z.number().int() });

const PartyOpenSchema = z.object({ kind: z.literal('partyOpen'), mediaId: z.string().min(1) });

const PartyJoinSchema = z.object({
  kind: z.literal('partyJoin'),
  partyId: z.string().min(1),
  password: z.string().min(1).max(200).optional(),
});

const PartyLeaveSchema = z.object({ kind: z.literal('partyLeave') });

const PartyCommandMessageSchema = z.object({
  kind: z.literal('partyCommand'),
  command: PartyCommandSchema,
});

const PartyReportSchema = z.object({
  kind: z.literal('partyReport'),
  positionSeconds: z.number().nonnegative(),
  bufferedAheadSeconds: z.number().nonnegative(),
  isWatching: z.boolean(),
});

const PartySetRoleSchema = z.object({
  kind: z.literal('partySetRole'),
  connectionId: z.string().min(1),
  role: PartyRoleSchema,
});

const PartyRemoveSchema = z.object({
  kind: z.literal('partyRemove'),
  connectionId: z.string().min(1),
});

const PartySetPasswordSchema = z.object({
  kind: z.literal('partySetPassword'),
  password: z.string().min(1).max(200).nullable(),
});

const PartyLoosenSchema = z.object({
  kind: z.literal('partyLoosen'),
  everyoneMaySeek: z.boolean().optional(),
  everyoneMayPlayPause: z.boolean().optional(),
});

const FromClientSchema = z.discriminatedUnion('kind', [
  SubscribeSchema,
  UnsubscribeSchema,
  IdentifySchema,
  PongSchema,
  ClockAskSchema,
  PartyOpenSchema,
  PartyJoinSchema,
  PartyLeaveSchema,
  PartyCommandMessageSchema,
  PartyReportSchema,
  PartySetRoleSchema,
  PartyRemoveSchema,
  PartySetPasswordSchema,
  PartyLoosenSchema,
]);

const WelcomeSchema = z.object({
  kind: z.literal('welcome'),
  connectionId: z.string().min(1),
  topics: z.array(RealtimeTopicSchema),
});

const SubscribedSchema = z.object({
  kind: z.literal('subscribed'),
  topics: z.array(RealtimeTopicSchema),
  refused: z.array(RealtimeTopicSchema),
});

const EventSchema = z.object({
  kind: z.literal('event'),
  topic: RealtimeTopicSchema,
  atMs: z.number().int().nonnegative(),
  folded: z.number().int().nonnegative(),
  payload: JsonValueSchema,
});

const DroppedSchema = z.object({
  kind: z.literal('dropped'),
  topics: z.array(RealtimeTopicSchema),
});

const PingSchema = z.object({ kind: z.literal('ping') });

const ClockTellSchema = z.object({
  kind: z.literal('clockTell'),
  sentAtMs: z.number().int(),
  serverAtMs: z.number().int(),
});

const RefusedSchema = z.object({ kind: z.literal('refused'), why: z.string().min(1) });

const PartyNeedsPasswordSchema = z.object({
  kind: z.literal('partyNeedsPassword'),
  partyId: z.string().min(1),
  wasWrong: z.boolean(),
});

const FromServerSchema = z.discriminatedUnion('kind', [
  WelcomeSchema,
  SubscribedSchema,
  EventSchema,
  DroppedSchema,
  PingSchema,
  ClockTellSchema,
  RefusedSchema,
  PartyNeedsPasswordSchema,
]);

type FromClient = z.infer<typeof FromClientSchema>;
type FromServer = z.infer<typeof FromServerSchema>;
type RealtimeEvent = z.infer<typeof EventSchema>;

/**
 * The permission a topic needs beyond being signed in, or null where being signed in is enough.
 * Kept as one table rather than checked at each publishing site, so that adding a topic without
 * deciding who may hear it is a type error rather than an accidental broadcast.
 *
 * @param topic - The topic being asked about.
 * @returns The permission it requires, or null.
 */
const permissionForTopic = (topic: RealtimeTopic): Permission | null => PERMISSION_BY_TOPIC[topic];

/**
 * Whether somebody holding these permissions may hear a topic. Asked on every message rather than
 * once when the connection opened, because roles are editable while a socket is held open and a
 * check that never runs again is not a check.
 *
 * @param topic - The topic being delivered.
 * @param held - The permissions resolved for whoever the connection is acting as.
 * @returns Whether it may be delivered.
 */
const mayHearTopic = (topic: RealtimeTopic, held: ReadonlySet<Permission>): boolean => {
  const needed = permissionForTopic(topic);

  return needed === null || held.has(needed);
};

/**
 * Splits requested topics into those this connection may hear and those it may not. Answering with
 * both halves lets the server tell a client plainly that it will never receive something, rather
 * than leaving it waiting for a feed that is silently never sent.
 *
 * @param asked - The topics the client asked for.
 * @param held - The permissions resolved for whoever the connection is acting as.
 * @returns The allowed topics and the refused ones.
 */
const splitByEntitlement = (
  asked: readonly RealtimeTopic[],
  held: ReadonlySet<Permission>,
): { allowed: RealtimeTopic[]; refused: RealtimeTopic[] } => {
  const allowed: RealtimeTopic[] = [];
  const refused: RealtimeTopic[] = [];

  for (const topic of asked) {
    if (mayHearTopic(topic, held)) {
      allowed.push(topic);
    } else {
      refused.push(topic);
    }
  }

  return { allowed, refused };
};

export type { RealtimeTopic, FromClient, FromServer, RealtimeEvent };

export {
  REALTIME_TOPICS,
  VIEWER_TOPICS,
  ADMIN_TOPICS,
  RealtimeTopicSchema,
  FromClientSchema,
  FromServerSchema,
  EventSchema,
  permissionForTopic,
  mayHearTopic,
  splitByEntitlement,
};
