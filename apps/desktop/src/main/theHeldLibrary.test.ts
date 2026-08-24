import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HeldFile, WhatToKeep } from '@ValenceContracts/schemas/HeldFile';
import { theHeldLibrary } from './theHeldLibrary';
import type { HeldIndex } from './theHeldIndex';

const WHERE = 'https://valence.test';

const asked: WhatToKeep = {
  downloadId: '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11',
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  durationSeconds: 5940,
  ofBytes: 11,
};

let folder = '';

const aMemoryIndex = (): HeldIndex => {
  const rows = new Map<string, HeldFile>();

  return {
    all: () => [...rows.values()],
    read: (downloadId) => rows.get(downloadId) ?? null,
    write: (file) => {
      rows.set(file.downloadId, file);
    },
    forget: (downloadId) => {
      rows.delete(downloadId);
    },
  };
};

const streamOf = (text: string, pauseFor = 0): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start: async (controller) => {
      for (const letter of text) {
        if (pauseFor > 0) {
          await new Promise((carryOn) => setTimeout(carryOn, pauseFor));
        }

        controller.enqueue(new TextEncoder().encode(letter));
      }

      controller.close();
    },
  });

type Serving = {
  film?: string;
  status?: number;
  poster?: string | null;
  pauseFor?: number;
};

const addressOf = (where: RequestInfo | URL): string => {
  if (typeof where === 'string') {
    return where;
  }

  return where instanceof URL ? where.href : where.url;
};

const rangeFrom = (how?: RequestInit): number => {
  const headers = how?.headers;
  const said = headers === undefined ? null : new Headers(headers).get('range');

  return Number(/bytes=(?<from>\d+)-/u.exec(said ?? '')?.groups?.['from'] ?? 0);
};

const aServer = (serving: Serving = {}) => {
  const seen: string[] = [];
  const film = serving.film ?? 'hello world';

  const fetching: typeof globalThis.fetch = (where, how) => {
    const address = addressOf(where);

    seen.push(address);

    if (address.includes('/image/poster')) {
      return Promise.resolve(
        serving.poster === null
          ? new Response('gone', { status: 404 })
          : new Response(serving.poster ?? 'an-image'),
      );
    }

    if ((serving.status ?? 200) !== 200) {
      return Promise.resolve(new Response('no', { status: serving.status }));
    }

    const from = rangeFrom(how);

    return Promise.resolve(
      from > 0
        ? new Response(streamOf(film.slice(from), serving.pauseFor), {
            status: 206,
            headers: { 'content-range': `bytes ${from}-${film.length - 1}/${film.length}` },
          })
        : new Response(streamOf(film, serving.pauseFor), {
            headers: { 'content-length': String(film.length) },
          }),
    );
  };

  return { fetching, seen };
};

const aLibrary = (serving: Serving = {}, index: HeldIndex = aMemoryIndex(), where = WHERE) => {
  const server = aServer(serving);

  inUse = index;

  return {
    index,
    seen: server.seen,
    library: theHeldLibrary({
      folder,
      index,
      where: () => where,
      fetching: server.fetching,
      now: () => '2026-08-22T00:00:00.000Z',
    }),
  };
};

let inUse: HeldIndex | null = null;

const settle = async (): Promise<void> => {
  const stopAt = Date.now() + 4000;

  while (Date.now() < stopAt) {
    if ((inUse?.all() ?? []).every((row) => row.state !== 'fetching')) {
      await new Promise((carryOn) => setTimeout(carryOn, 10));

      return;
    }

    await new Promise((carryOn) => setTimeout(carryOn, 5));
  }
};

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'valence-library-'));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe('theHeldLibrary', () => {
  it('puts a film on the disk and says it is here', async () => {
    const { library } = aLibrary();

    await library.keep(asked);
    await settle();

    const [held] = await library.all();

    expect(held?.state).toBe('here');
    await expect(readFile(join(folder, `${asked.downloadId}.mp4`), 'utf8')).resolves.toBe(
      'hello world',
    );
  });

  it('fetches the artwork beside it, so the shelf is not grey rectangles', async () => {
    const { library } = aLibrary();

    await library.keep(asked);
    await settle();

    const [held] = await library.all();

    expect(held?.hasPoster).toBe(true);
    await expect(stat(join(folder, `${asked.downloadId}.jpg`))).resolves.toBeTruthy();
  });

  it('keeps the film even where the artwork could not be fetched', async () => {
    const { library } = aLibrary({ poster: null });

    await library.keep(asked);
    await settle();

    const [held] = await library.all();

    expect([held?.state, held?.hasPoster]).toEqual(['here', false]);
  });

  it('keeps the film even where the artwork could not be written down', async () => {
    const { library } = aLibrary();

    await mkdir(join(folder, `${asked.downloadId}.jpg`), { recursive: true });

    await library.keep(asked);
    await settle();

    const [held] = await library.all();

    expect([held?.state, held?.hasPoster]).toEqual(['here', false]);
  });

  it('stops offering something whose file somebody deleted from Finder', async () => {
    const { library } = aLibrary();

    await library.keep(asked);
    await settle();
    await rm(join(folder, `${asked.downloadId}.mp4`));

    await expect(library.all()).resolves.toEqual([]);
  });

  it('does not fetch a second copy of something already here', async () => {
    const { library, seen } = aLibrary();

    await library.keep(asked);
    await settle();

    const asFarAs = seen.length;

    await library.keep(asked);
    await settle();

    expect(seen).toHaveLength(asFarAs);
  });

  it('leaves a paused transfer saying so, with what arrived still on the disk', async () => {
    const { library } = aLibrary({ film: 'abcdefghijklmnop', pauseFor: 15 });

    await library.keep(asked);
    await new Promise((carryOn) => setTimeout(carryOn, 40));

    await library.pause(asked.downloadId, true);
    await settle();

    const [held] = await library.all();

    expect(held?.state).toBe('paused');
    expect(held?.bytes).toBeGreaterThan(0);
    expect(held?.bytes).toBeLessThan(16);
  });

  it('asks only for the rest when it carries on', async () => {
    const index = aMemoryIndex();
    const { library, seen } = aLibrary({ film: 'abcdefghijklmnop', pauseFor: 15 }, index);

    await library.keep(asked);
    await new Promise((carryOn) => setTimeout(carryOn, 40));
    await library.pause(asked.downloadId, true);
    await settle();

    const stopped = index.read(asked.downloadId)?.bytes ?? 0;

    seen.length = 0;

    await library.pause(asked.downloadId, false);
    await settle();

    expect(stopped).toBeGreaterThan(0);
    await expect(readFile(join(folder, `${asked.downloadId}.mp4`), 'utf8')).resolves.toBe(
      'abcdefghijklmnop',
    );
  });

  it('forgets a download and takes its file with it', async () => {
    const { library } = aLibrary();

    await library.keep(asked);
    await settle();
    await library.drop(asked.downloadId);

    await expect(library.all()).resolves.toEqual([]);
    await expect(stat(join(folder, `${asked.downloadId}.mp4`))).rejects.toThrow();
    await expect(stat(join(folder, `${asked.downloadId}.jpg`))).rejects.toThrow();
  });

  it('says why something failed rather than losing it', async () => {
    const { library } = aLibrary({ status: 503 });

    await library.keep(asked);
    await settle();

    const [held] = await library.all();

    expect([held?.state, held?.failure]).toEqual(['failed', 'The server answered 503.']);
  });

  it('refuses to invent a server that was never chosen', async () => {
    const { library } = aLibrary({}, aMemoryIndex(), '');

    await library.keep(asked);
    await settle();

    const [held] = await library.all();

    expect([held?.state, held?.failure]).toEqual(['failed', 'No Valence has been chosen yet.']);
  });

  it('picks an interrupted transfer back up, and leaves a paused one paused', async () => {
    const index = aMemoryIndex();

    index.write({
      ...asked,
      downloadId: '11111111-1111-4111-8111-111111111111',
      state: 'fetching',
      bytes: 0,
      bytesPerSecond: null,
      failure: null,
      keptAt: '2026-08-22T00:00:00.000Z',
      hasPoster: false,
    });

    index.write({
      ...asked,
      downloadId: '22222222-2222-4222-8222-222222222222',
      state: 'paused',
      bytes: 4,
      bytesPerSecond: null,
      failure: null,
      keptAt: '2026-08-22T00:00:00.000Z',
      hasPoster: false,
    });

    const { library } = aLibrary({}, index);

    await library.carryOnWhereItLeftOff();
    await settle();

    expect(index.read('11111111-1111-4111-8111-111111111111')?.state).toBe('here');
    expect(index.read('22222222-2222-4222-8222-222222222222')?.state).toBe('paused');
  });

  it('tells whoever is listening when something changes', async () => {
    const { library } = aLibrary();
    const told: HeldFile[][] = [];

    library.whenChanged((held) => told.push(held));

    await library.keep(asked);
    await settle();

    expect(told.length).toBeGreaterThan(0);
    expect(told.at(-1)?.[0]?.state).toBe('here');
  });

  it('stops telling a listener that let go', async () => {
    const { library } = aLibrary();
    let told = 0;

    library.whenChanged(() => {
      told += 1;
    })();

    await library.keep(asked);
    await settle();

    expect(told).toBe(0);
  });
});
