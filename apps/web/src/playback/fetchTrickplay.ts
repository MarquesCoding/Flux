import { z } from 'zod';

const TrickplaySchema = z.object({
  id: z.string(),
  url: z.string(),
  intervalSeconds: z.number(),
  tileWidth: z.number(),
  tileHeight: z.number(),
});

type Thumbnail = {
  startSeconds: number;
  endSeconds: number;
  sheetUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Trickplay = {
  thumbnails: Thumbnail[];
  width: number;
  height: number;
};

const TIMESTAMP = /(\d+):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/;

/**
 * Reads a `WebVTT` timestamp as seconds.
 */
const readTimestamp = (value: string): number | null => {
  const match = TIMESTAMP.exec(value.trim());

  if (match === null) {
    return null;
  }

  const [, hours = '0', minutes = '0', seconds = '0', milliseconds = '0'] = match;

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(milliseconds.padEnd(3, '0')) / 1000
  );
};

/**
 * Reads the rectangle a cue points at.
 *
 * The `#xywh` fragment is what tells a player where in a sheet a thumbnail
 * sits. A cue without one names a whole image, which Flux never writes, so it
 * is skipped rather than guessed at.
 */
const readRectangle = (
  payload: string,
): { name: string; x: number; y: number; width: number; height: number } | null => {
  const [name = '', fragment] = payload.trim().split('#xywh=');

  if (fragment === undefined) {
    return null;
  }

  const parts = fragment.split(',').map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [x = 0, y = 0, width = 0, height = 0] = parts;

  return { name, x, y, width, height };
};

/**
 * Turns a `WebVTT` index into thumbnails.
 *
 * Sheet names in the index are relative, so they are resolved against the
 * index's own URL exactly as a browser would resolve them.
 */
const parseTrickplayIndex = (vtt: string, indexUrl: string): Thumbnail[] => {
  const thumbnails: Thumbnail[] = [];
  const lines = vtt.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!line.includes('-->')) {
      continue;
    }

    const [from = '', to = ''] = line.split('-->');
    const startSeconds = readTimestamp(from);
    const endSeconds = readTimestamp(to);
    const rectangle = readRectangle(lines[index + 1] ?? '');

    if (startSeconds === null || endSeconds === null || rectangle === null) {
      continue;
    }

    thumbnails.push({
      startSeconds,
      endSeconds,
      sheetUrl: new URL(rectangle.name, new URL(indexUrl, window.location.origin)).toString(),
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
    });
  }

  return thumbnails;
};

/**
 * Finds the thumbnail covering a moment.
 *
 * Answers with the nearest earlier thumbnail rather than nothing when a moment
 * falls past the last cue, so scrubbing to the very end of a film still shows
 * a picture.
 */
const thumbnailAt = (thumbnails: Thumbnail[], seconds: number): Thumbnail | null => {
  let best: Thumbnail | null = null;

  for (const thumbnail of thumbnails) {
    if (thumbnail.startSeconds <= seconds) {
      best = thumbnail;
    }
  }

  return best ?? thumbnails[0] ?? null;
};

/**
 * Asks the server for seek-bar previews.
 *
 * Answers with nothing rather than throwing when they cannot be made: previews
 * are a convenience, and a film that cannot have them must still play.
 */
const fetchTrickplay = async (mediaId: string): Promise<Trickplay | null> => {
  try {
    const response = await fetch(`/api/playback/${mediaId}/trickplay`, { method: 'POST' });

    if (!response.ok) {
      return null;
    }

    const index = TrickplaySchema.parse(await response.json());
    const vtt = await fetch(index.url);

    if (!vtt.ok) {
      return null;
    }

    const thumbnails = parseTrickplayIndex(await vtt.text(), index.url);

    if (thumbnails.length === 0) {
      return null;
    }

    return { thumbnails, width: index.tileWidth, height: index.tileHeight };
  } catch {
    return null;
  }
};

export type { Thumbnail, Trickplay };

export { fetchTrickplay, parseTrickplayIndex, thumbnailAt, readTimestamp };
