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
type ShareKind = z.infer<typeof ShareKindSchema>;
type NewShare = z.infer<typeof NewShareSchema>;
type CreatedShare = z.infer<typeof CreatedShareSchema>;

type ShareStanding = {
  expiresAt: Date | null;
  viewCap: number | null;
  views: number;
  revokedAt: Date | null;
};

/**
 * Decides whether a share still works. A link the creator believed would stop working and does not
 * is the failure that matters most here, so this answers on the standing alone — revoked, expired,
 * or spent — and never on who is asking or what they want.
 *
 * Revocation is immediate by construction: it is read on every request rather than remembered from
 * when a session began, so a stream already playing stops at its next request.
 *
 * @param standing - What the share was created with and how far it has been used.
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

  return standing.viewCap === null || standing.views < standing.viewCap;
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
  if (standing.revokedAt !== null) {
    return 'This link was withdrawn.';
  }

  if (standing.expiresAt !== null && standing.expiresAt.getTime() <= now.getTime()) {
    return 'This link has expired.';
  }

  if (standing.viewCap !== null && standing.views >= standing.viewCap) {
    return 'This link has been opened as many times as it was meant to be.';
  }

  return null;
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

export type { Share, ShareKind, NewShare, CreatedShare, ShareStanding };

export {
  ShareSchema,
  ShareListSchema,
  ShareKindSchema,
  NewShareSchema,
  CreatedShareSchema,
  isShareLive,
  whyShareEnded,
  shareReaches,
  SHARE_KINDS,
};
