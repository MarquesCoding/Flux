import { createAvatar } from '@dicebear/core';
import { adventurer, bottts, funEmoji, lorelei, notionists, thumbs } from '@dicebear/collection';

const AVATAR_STYLES = {
  adventurer: (seed: string) => createAvatar(adventurer, { seed, radius: 50 }).toString(),
  lorelei: (seed: string) => createAvatar(lorelei, { seed, radius: 50 }).toString(),
  notionists: (seed: string) => createAvatar(notionists, { seed, radius: 50 }).toString(),
  bottts: (seed: string) => createAvatar(bottts, { seed, radius: 50 }).toString(),
  funEmoji: (seed: string) => createAvatar(funEmoji, { seed, radius: 50 }).toString(),
  thumbs: (seed: string) => createAvatar(thumbs, { seed, radius: 50 }).toString(),
} as const;

type AvatarStyle = keyof typeof AVATAR_STYLES;

/**
 * Whether this is a style Flux draws.
 */
const isAvatarStyle = (candidate: string): candidate is AvatarStyle =>
  Object.hasOwn(AVATAR_STYLES, candidate);

/**
 * Draws an avatar as an SVG.
 */
const drawAvatar = (style: AvatarStyle, seed: string): string => AVATAR_STYLES[style](seed);

export type { AvatarStyle };

export { drawAvatar, isAvatarStyle, AVATAR_STYLES };
