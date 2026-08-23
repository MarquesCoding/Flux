import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import { theFileKept, thePosterKept } from '@ValenceDesktop/main/theHeldFolder';

const HELD = /^\/held\/(?<downloadId>[0-9a-fA-F-]{36})(?<what>\/poster)?$/u;

const RANGE = /^bytes=(?<from>\d*)-(?<to>\d*)$/u;

const DownloadIdSchema = z.string().uuid();

type Asked = {
  path: string;
  kind: string;
};

/**
 * Turns a file being read off the disk into a body a response can carry.
 *
 * Node's own conversion produces a stream typed by Node's stream library rather than by the web, and
 * the two are the same idea described twice. Wrapping it by hand is a few lines and keeps the
 * boundary honest, where declaring one to be the other would only silence it.
 *
 * Backpressure is kept: the file is paused when the page has taken as much as it wants and resumed
 * when it asks for more. Without it, playing a four gigabyte film would read a four gigabyte film
 * into memory as fast as the disk could manage.
 *
 * @param from - The file being read.
 * @returns The same bytes, as something a response will take.
 */
const asABody = (from: Readable): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      from.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));

        if ((controller.desiredSize ?? 0) <= 0) {
          from.pause();
        }
      });

      from.on('end', () => {
        controller.close();
      });

      from.on('error', (problem: Error) => {
        controller.error(problem);
      });
    },
    pull: () => {
      from.resume();
    },
    cancel: () => {
      from.destroy();
    },
  });

/**
 * Which file on this disk an address is asking for, if any.
 *
 * The download id is insisted upon rather than trimmed, and this is the reason the check exists: a
 * path built out of whatever the renderer sent is how a renderer reads the rest of the machine. A
 * name shaped like a download id cannot climb out of the folder, whatever else is wrong with it.
 *
 * @param folder - Where held files are kept.
 * @param pathname - What was asked for.
 * @returns The file and what kind of thing it is, or nothing where this is not a held file at all.
 */
const whatWasAsked = (folder: string, pathname: string): Asked | null => {
  const found = HELD.exec(pathname)?.groups;
  const downloadId = DownloadIdSchema.safeParse(found?.['downloadId']);

  if (!downloadId.success) {
    return null;
  }

  return found?.['what'] === undefined
    ? { path: theFileKept(folder, downloadId.data), kind: 'video/mp4' }
    : { path: thePosterKept(folder, downloadId.data), kind: 'image/jpeg' };
};

/**
 * Which part of a file was asked for.
 *
 * A player does not fetch a film. It fetches the beginning, reads where the index is, fetches that,
 * and then fetches whatever second somebody drags the scrubber to — so a route that only ever
 * answers with the whole file gives a video that plays from the start and cannot be moved through.
 *
 * An open-ended ask means to the end. An ask beginning past the end is nonsense rather than empty,
 * and is answered as the whole file rather than as a negative length.
 *
 * @param range - What the player asked for.
 * @param size - How long the file is.
 * @returns Where to start and stop, or nothing where the whole file was wanted.
 */
const whichPart = (range: string | null, size: number): { from: number; to: number } | null => {
  const found = range === null ? undefined : RANGE.exec(range)?.groups;

  if (found === undefined) {
    return null;
  }

  const said = found['from'] ?? '';
  const until = found['to'] ?? '';

  if (said === '') {
    const howMuch = Number(until);

    return until === '' || howMuch <= 0
      ? null
      : { from: Math.max(size - howMuch, 0), to: size - 1 };
  }

  const from = Number(said);

  if (from >= size) {
    return null;
  }

  return { from, to: until === '' ? size - 1 : Math.min(Number(until), size - 1) };
};

/**
 * Serves a file this machine is holding, to the player in this client's own window.
 *
 * This is what a download is for. The file is already exactly the rendition that was asked for, so
 * nothing here negotiates, transcodes or builds a playlist — it is handed over as it lies, and the
 * player treats it as it would treat any progressive video on the web.
 *
 * Served on this client's own scheme rather than as a local file. A renderer cannot read `file://`,
 * and giving it permission to would be handing the page the whole disk in order to play one film.
 *
 * @param folder - Where held files are kept.
 * @param pathname - What was asked for.
 * @param range - Which part of it, where the player asked for a part.
 * @returns The file, the part of it that was asked for, or a refusal.
 */
const aHeldFile = async (
  folder: string,
  pathname: string,
  range: string | null,
): Promise<Response> => {
  const asked = whatWasAsked(folder, pathname);

  if (asked === null) {
    return new Response('Not a held file.', { status: 404 });
  }

  const there = await stat(asked.path).catch(() => null);

  if (there === null) {
    return new Response('This client is not holding that.', { status: 404 });
  }

  const part = whichPart(range, there.size);

  const headers: Record<string, string> = {
    'content-type': asked.kind,
    'accept-ranges': 'bytes',
  };

  if (part === null) {
    return new Response(asABody(createReadStream(asked.path)), {
      headers: { ...headers, 'content-length': String(there.size) },
    });
  }

  return new Response(asABody(createReadStream(asked.path, { start: part.from, end: part.to })), {
    status: 206,
    headers: {
      ...headers,
      'content-length': String(part.to - part.from + 1),
      'content-range': `bytes ${part.from}-${part.to}/${there.size}`,
    },
  });
};

export { aHeldFile, whatWasAsked, whichPart };
