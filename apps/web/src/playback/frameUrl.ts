const FRAME_WIDTH = 1280;

/**
 * Where a single frame of an item is served from.
 */
const frameUrl = (mediaId: string, seconds: number, width = FRAME_WIDTH): string =>
  `/api/playback/${mediaId}/frame?seconds=${Math.max(0, Math.floor(seconds)).toString()}&width=${width.toString()}`;

export { frameUrl, FRAME_WIDTH };
