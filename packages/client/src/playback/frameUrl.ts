import { serverUrl } from '@FluxClient/query/serverUrl';

const FRAME_WIDTH = 1280;

/**
 * Builds the address one frame of an item is served from, which is what a still is taken from
 * without a session being started.
 *
 * @param mediaId - The item.
 * @param seconds - Which moment to render.
 * @param width - How wide to render it.
 * Built onto the server this client watches, because an `img` resolves what it is given against the
 * page it is on — and a client serving its own pages would ask itself for a frame of a film.
 *
 * @returns The address to load.
 */
const frameUrl = (mediaId: string, seconds: number, width = FRAME_WIDTH): string =>
  serverUrl(
    `/api/playback/${mediaId}/frame?seconds=${Math.max(0, Math.floor(seconds)).toString()}&width=${width.toString()}`,
  );

export { frameUrl, FRAME_WIDTH };
