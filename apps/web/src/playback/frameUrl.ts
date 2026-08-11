/**
 * How wide a still is asked for.
 *
 * Wide enough to fill a hero on a laptop without being asked to scale up, and
 * small enough to arrive in the time it takes to notice it is missing.
 */
const FRAME_WIDTH = 1280

/**
 * Where a single frame of an item is served from.
 *
 * The position is part of the address so a browser caches each frame
 * separately, and so asking for the same moment twice costs nothing.
 */
const frameUrl = (mediaId: string, seconds: number, width = FRAME_WIDTH): string =>
  `/api/playback/${mediaId}/frame?seconds=${Math.max(0, Math.floor(seconds)).toString()}&width=${width.toString()}`

export { frameUrl, FRAME_WIDTH }
