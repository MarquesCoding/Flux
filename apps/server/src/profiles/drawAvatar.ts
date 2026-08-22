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
 * Decides whether a stored value names a style Valence actually draws, so a value written by a newer
 * version falls back rather than rendering nothing.
 *
 * @param candidate - The style as stored.
 * @returns Whether it is one Valence can draw.
 */
const isAvatarStyle = (candidate: string): candidate is AvatarStyle =>
  Object.hasOwn(AVATAR_STYLES, candidate);

/**
 * Draws a profile's avatar as an SVG, built from the style and colours it was given. Drawn here
 * rather than fetched, so a household's faces never leave the server and never depend on one.
 *
 * @param style - The style to draw in.
 * @param seed - What the drawing is derived from, so the same profile is always drawn the same.
 * @returns The avatar, as SVG.
 */
const drawAvatar = (style: AvatarStyle, seed: string): string => AVATAR_STYLES[style](seed);

export type { AvatarStyle };

export { drawAvatar, isAvatarStyle, AVATAR_STYLES };
