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
 * Reads a WebVTT timestamp as a number of seconds.
 *
 * @param value - The timestamp as the index wrote it.
 * @returns The position in seconds.
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
 * Reads the rectangle a cue points at inside its sheet, since a thumbnail index addresses one tile
 * of a larger image rather than an image of its own.
 *
 * @param payload - The cue's fragment, naming the tile.
 * @returns Where the tile sits in the sheet.
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
 * Turns the index the server writes into the thumbnails a scrubber draws, each knowing which sheet
 * it is in and where.
 *
 * @param vtt - The index as WebVTT.
 * @param indexUrl - Where the sheets are served from.
 * @returns The thumbnails, in order.
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
 * Finds the thumbnail covering a moment in the film, for the preview shown above the scrubber.
 *
 * @param thumbnails - The thumbnails available.
 * @param seconds - The moment being pointed at.
 * @returns The thumbnail to draw, or null where none covers it.
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
 * Asks the server for the thumbnails shown while scrubbing. Answers with nothing rather than
 * throwing where an item has none: scrubbing without previews is scrubbing, and a player that
 * refused to open over it would be worse.
 *
 * @param mediaId - The item being played.
 * @returns The thumbnails, or null where there are none.
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

export type { Trickplay };

export { fetchTrickplay, parseTrickplayIndex, thumbnailAt, readTimestamp };
