import { readFromServer } from '@FluxWeb/query/readFromServer';
import { z } from 'zod';
import {
  AdminShareListSchema,
  CreatedShareSchema,
  ShareEndingSchema,
  ShareListSchema,
} from '@FluxContracts/schemas/Share';
import { MediaSummarySchema } from '@FluxContracts/schemas/Library';
import type {
  AdminShare,
  CreatedShare,
  NewShare,
  Share,
  ShareEnding,
} from '@FluxContracts/schemas/Share';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const OpenedShareSchema = z.object({
  kind: z.enum(['item', 'series']),
  title: z.string(),
  items: z.array(MediaSummarySchema),
});

type OpenedShare = z.infer<typeof OpenedShareSchema>;

type ShareOutcome =
  | { kind: 'opened'; share: OpenedShare }
  | { kind: 'gone'; reason: string; ended: ShareEnding }
  | { kind: 'unknown' };

/**
 * Reads the links this account has handed out, with how far each has been used.
 *
 * @returns The links, or none where the request failed.
 */
const fetchShares = async (): Promise<Share[]> => {
  return (await readFromServer('/api/shares', ShareListSchema)).shares;
};

/**
 * Reads every link this server has handed out, whoever handed it out, for somebody allowed to look
 * after all of them.
 *
 * @returns The links, or none where the request failed or this account may not see them.
 */
const fetchEverybodysShares = async (): Promise<AdminShare[]> => {
  return (await readFromServer('/api/admin/shares', AdminShareListSchema)).shares;
};

/**
 * Hands out a link to something. The token comes back this once and never again, so whatever asks
 * for it has to show it there and then — the server keeps only a hash of it.
 *
 * @param asked - What to share, and what should end the link.
 * @returns The link, or null where the server refused.
 */
const createShare = async (asked: NewShare): Promise<CreatedShare | null> => {
  const response = await fetch('/api/shares', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(asked),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  try {
    return CreatedShareSchema.parse(await response.json());
  } catch {
    return null;
  }
};

/**
 * Withdraws a link. Takes effect at once, including for somebody already watching through it — the
 * standing is read on every request rather than remembered from when a session began.
 *
 * @param shareId - The link to withdraw.
 * @returns Whether it was withdrawn.
 */
const revokeShare = async (shareId: string): Promise<boolean> => {
  const response = await fetch(`/api/shares/${shareId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Withdraws anybody's link, for somebody allowed to look after all of them. Whoever made it is told,
 * unless they are the one withdrawing it.
 *
 * @param shareId - The link to withdraw.
 * @returns Whether it was withdrawn.
 */
const revokeAnybodysShare = async (shareId: string): Promise<boolean> => {
  const response = await fetch(`/api/admin/shares/${shareId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response !== null && response.ok;
};

/**
 * Opens a link as somebody with no account. Distinguishes a link that never existed from one that
 * has run out, because those are different things to be told: the first is a wrong address and the
 * second is an invitation that has closed.
 *
 * @param token - The token the link carries.
 * @returns What was shared, or why it is not available.
 */
const openShare = async (token: string): Promise<ShareOutcome> => {
  try {
    const response = await fetch(`/api/share/${encodeURIComponent(token)}`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (response.status === 410) {
      const said = z
        .object({ error: z.string(), ended: ShareEndingSchema })
        .safeParse(await response.json());

      return {
        kind: 'gone',
        reason: said.success ? said.data.error : 'This link no longer works.',
        ended: said.success ? said.data.ended : 'withdrawn',
      };
    }

    if (!response.ok) {
      return { kind: 'unknown' };
    }

    return { kind: 'opened', share: OpenedShareSchema.parse(await response.json()) };
  } catch {
    return { kind: 'unknown' };
  }
};

/**
 * Writes the address a link is handed out as, so that whoever created it can copy something a friend
 * can open rather than a token they would have to assemble into a URL themselves.
 *
 * @param token - The token the link carries.
 * @param origin - Where this server is reachable.
 * @returns The address to hand over.
 */
const shareAddress = (token: string, origin: string): string =>
  `${origin}/share/${encodeURIComponent(token)}`;

export type { OpenedShare, ShareOutcome, MediaSummary };

export {
  fetchShares,
  fetchEverybodysShares,
  createShare,
  revokeShare,
  revokeAnybodysShare,
  openShare,
  shareAddress,
  OpenedShareSchema,
};
