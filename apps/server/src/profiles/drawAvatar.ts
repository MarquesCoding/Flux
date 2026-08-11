import { createAvatar } from '@dicebear/core'
import { adventurer, bottts, funEmoji, lorelei, notionists, thumbs } from '@dicebear/collection'

/**
 * The styles somebody may choose from, each as the call that draws it.
 *
 * A short list rather than the whole collection: forty styles is a decision
 * nobody wants to make about a picture beside their name, and six is a glance.
 *
 * One function per style rather than one function over a map of styles,
 * because every style declares its own options and a map of them collapses to
 * a type no call can satisfy.
 */
const AVATAR_STYLES = {
  adventurer: (seed: string) => createAvatar(adventurer, { seed, radius: 50 }).toString(),
  lorelei: (seed: string) => createAvatar(lorelei, { seed, radius: 50 }).toString(),
  notionists: (seed: string) => createAvatar(notionists, { seed, radius: 50 }).toString(),
  bottts: (seed: string) => createAvatar(bottts, { seed, radius: 50 }).toString(),
  funEmoji: (seed: string) => createAvatar(funEmoji, { seed, radius: 50 }).toString(),
  thumbs: (seed: string) => createAvatar(thumbs, { seed, radius: 50 }).toString(),
} as const

type AvatarStyle = keyof typeof AVATAR_STYLES

/**
 * Whether this is a style Flux draws.
 */
const isAvatarStyle = (candidate: string): candidate is AvatarStyle =>
  Object.hasOwn(AVATAR_STYLES, candidate)

/**
 * Draws an avatar as an SVG.
 *
 * Rendered here rather than in the browser, and from a library rather than
 * from an address: a self-hosted server should not tell a third party who has
 * profiles on it, and a picture that stops existing when somebody else's
 * service goes down is not a picture worth storing a reference to.
 *
 * The style and seed are all that is kept, so the same face comes back every
 * time from a few bytes rather than from a stored image.

 */
const drawAvatar = (style: AvatarStyle, seed: string): string => AVATAR_STYLES[style](seed)

export type { AvatarStyle }

export default { drawAvatar, isAvatarStyle, AVATAR_STYLES }
