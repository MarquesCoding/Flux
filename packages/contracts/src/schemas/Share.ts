import { z } from 'zod';

const SHARE_KINDS = ['item', 'series'] as const;

const ShareKindSchema = z.enum(SHARE_KINDS);

const ShareSchema = z.object({
  id: z.string().uuid(),
  kind: ShareKindSchema,
  mediaId: z.string().uuid().nullable(),
  seriesId: z.string().uuid().nullable(),
  title: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  viewCap: z.number().int().positive().nullable(),
  views: z.number().int().nonnegative(),
  isRevoked: z.boolean(),
  isSpent: z.boolean(),
});

const ShareListSchema = z.object({ shares: z.array(ShareSchema) });

const AdminShareSchema = ShareSchema.extend({
  createdBy: z.string(),
  createdByName: z.string(),
});

const AdminShareListSchema = z.object({ shares: z.array(AdminShareSchema) });

const NewShareSchema = z
  .object({
    kind: ShareKindSchema,
    mediaId: z.string().uuid().optional(),
    seriesId: z.string().uuid().optional(),
    expiresAt: z.string().datetime().nullish(),
    viewCap: z.number().int().positive().nullish(),
  })
  .refine(
    (asked) => (asked.kind === 'item' ? asked.mediaId !== undefined : asked.seriesId !== undefined),
    { message: 'A share names either an item or a series, matching its kind.' },
  );

const CreatedShareSchema = ShareSchema.extend({ token: z.string().min(1) });

type Share = z.infer<typeof ShareSchema>;
type AdminShare = z.infer<typeof AdminShareSchema>;
type ShareKind = z.infer<typeof ShareKindSchema>;
type NewShare = z.infer<typeof NewShareSchema>;
type CreatedShare = z.infer<typeof CreatedShareSchema>;

type ShareStanding = {
  expiresAt: Date | null;
  viewCap: number | null;
  views: number;
  revokedAt: Date | null;
  isReturning?: boolean;
};

/**
 * Decides whether a share still works. A link the creator believed would stop working and does not
 * is the failure that matters most here, so this answers on the standing alone — revoked, expired,
 * or spent — and never on who is asking or what they want.
 *
 * Revocation is immediate by construction: it is read on every request rather than remembered from
 * when a session began, so a stream already playing stops at its next request.
 *
 * A cap counts the people let in, so somebody already among them is not turned away by it. The
 * alternative locks the one person a link was made for out of it the moment they arrive — they are
 * counted on the way in, and every request after that is measured against a total they are already
 * part of.
 *
 * @param standing - What the share was created with, how far it has been used, and whether whoever
 *   is asking has been let in before.
 * @param now - The moment being judged.
 * @returns Whether the share is still good.
 */
const isShareLive = (standing: ShareStanding, now: Date): boolean => {
  if (standing.revokedAt !== null) {
    return false;
  }

  if (standing.expiresAt !== null && standing.expiresAt.getTime() <= now.getTime()) {
    return false;
  }

  return (
    standing.viewCap === null || standing.isReturning === true || standing.views < standing.viewCap
  );
};

const SHARE_ENDINGS = ['withdrawn', 'expired', 'spent'] as const;

const ShareEndingSchema = z.enum(SHARE_ENDINGS);

type ShareEnding = (typeof SHARE_ENDINGS)[number];

/**
 * Says which of the three ways a share ended, for a screen that treats them as the different things
 * they are. Answers with null while it still works.
 *
 * The order is the order of certainty rather than of likelihood: a withdrawn link was withdrawn even
 * if it would also have expired by now, because that is what somebody did to it.
 *
 * @param standing - What the share was created with and how far it has been used.
 * @param now - The moment being judged.
 * @returns How it ended, or null where nothing has.
 */
const howShareEnded = (standing: ShareStanding, now: Date): ShareEnding | null => {
  if (standing.revokedAt !== null) {
    return 'withdrawn';
  }

  if (standing.expiresAt !== null && standing.expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }

  return standing.viewCap !== null &&
    standing.isReturning !== true &&
    standing.views >= standing.viewCap
    ? 'spent'
    : null;
};

const SHARE_ENDING_SAID: Record<ShareEnding, string> = {
  withdrawn: 'This link was withdrawn.',
  expired: 'This link has expired.',
  spent: 'This link has been used up.',
};

/**
 * Says why a share is no longer good, for telling somebody holding a dead link something better
 * than that it does not work. Answers with null while it still works.
 *
 * @param standing - What the share was created with and how far it has been used.
 * @param now - The moment being judged.
 * @returns What ended it, or null where nothing has.
 */
const whyShareEnded = (standing: ShareStanding, now: Date): string | null => {
  const ending = howShareEnded(standing, now);

  return ending === null ? null : SHARE_ENDING_SAID[ending];
};

/**
 * Whether a share of this kind may reach a given item. Scope is chosen at creation and never
 * exceeded — a share is never a way into the library, into search, or into any title outside what
 * was shared. Asked at the route rather than trusted to a query, so that a later edit to a `where`
 * clause cannot quietly widen what a link reaches.
 *
 * @param scope - What the share covers.
 * @param item - The item being asked for, and the series it belongs to where it has one.
 * @returns Whether the share reaches it.
 */
const shareReaches = (
  scope: { kind: ShareKind; mediaId: string | null; seriesId: string | null },
  item: { id: string; seriesId: string | null },
): boolean =>
  scope.kind === 'item'
    ? scope.mediaId === item.id
    : scope.seriesId !== null && scope.seriesId === item.seriesId;

export type { Share, AdminShare, ShareKind, NewShare, CreatedShare, ShareStanding, ShareEnding };

export {
  ShareSchema,
  ShareListSchema,
  AdminShareSchema,
  AdminShareListSchema,
  ShareKindSchema,
  NewShareSchema,
  CreatedShareSchema,
  isShareLive,
  howShareEnded,
  whyShareEnded,
  ShareEndingSchema,
  SHARE_ENDINGS,
  SHARE_ENDING_SAID,
  shareReaches,
  SHARE_KINDS,
};
