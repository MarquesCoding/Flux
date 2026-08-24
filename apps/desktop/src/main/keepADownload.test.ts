import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { keepADownload } from './keepADownload';
import type { Progress } from './keepADownload';

let folder = '';

const streamOf = (chunks: string[], pauseFor = 0): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start: async (controller) => {
      for (const chunk of chunks) {
        if (pauseFor > 0) {
          await new Promise((carryOn) => setTimeout(carryOn, pauseFor));
        }

        controller.enqueue(new TextEncoder().encode(chunk));
      }

      controller.close();
    },
  });

const answering = (
  answer: Response,
  seen: { asked?: RequestInit } = {},
): typeof globalThis.fetch => {
  const fetching: typeof globalThis.fetch = (_where, how) => {
    seen.asked = how;

    return Promise.resolve(answer);
  };

  return fetching;
};

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'valence-held-'));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe('keepADownload', () => {
  it('puts the file on the disk and says it finished', async () => {
    const onto = join(folder, 'film.mp4');

    const outcome = await keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto,
      already: 0,
      fetching: answering(
        new Response(streamOf(['hello ', 'world']), { headers: { 'content-length': '11' } }),
      ),
      report: () => {},
    }).finished;

    expect(outcome).toEqual({ bytes: 11, isComplete: true, failure: null });
    await expect(readFile(onto, 'utf8')).resolves.toBe('hello world');
  });

  it('asks for the rest of a file it already has some of', async () => {
    const onto = join(folder, 'film.mp4');
    const seen: { asked?: RequestInit } = {};

    await writeFile(onto, 'hello ');

    await keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto,
      already: 6,
      fetching: answering(
        new Response(streamOf(['world']), {
          status: 206,
          headers: { 'content-range': 'bytes 6-10/11' },
        }),
        seen,
      ),
      report: () => {},
    }).finished;

    expect(seen.asked?.headers).toEqual({ range: 'bytes=6-' });
    await expect(readFile(onto, 'utf8')).resolves.toBe('hello world');
  });

  it('reads the whole length from a partial answer rather than the length of the piece', async () => {
    const told: Progress[] = [];

    await keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto: join(folder, 'film.mp4'),
      already: 6,
      fetching: answering(
        new Response(streamOf(['world'], 2), {
          status: 206,
          headers: { 'content-range': 'bytes 6-10/11' },
        }),
      ),
      report: (progress) => told.push(progress),
    }).finished;

    expect(told.every((progress) => progress.ofBytes === 11)).toBe(true);
  });

  it('adds what is on the disk to the length where the server did not state the whole', async () => {
    const told: Progress[] = [];

    await keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto: join(folder, 'film.mp4'),
      already: 6,
      fetching: answering(
        new Response(streamOf(['world'], 2), { status: 206, headers: { 'content-length': '5' } }),
      ),
      report: (progress) => told.push(progress),
    }).finished;

    expect(told.every((progress) => progress.ofBytes === 11)).toBe(true);
  });

  it('starts the file again where the server ignored the range and sent everything', async () => {
    const onto = join(folder, 'film.mp4');

    await writeFile(onto, 'hello ');

    const outcome = await keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto,
      already: 6,
      fetching: answering(
        new Response(streamOf(['hello world']), { headers: { 'content-length': '11' } }),
      ),
      report: () => {},
    }).finished;

    expect(outcome.bytes).toBe(11);
    await expect(readFile(onto, 'utf8')).resolves.toBe('hello world');
  });

  it('says what went wrong where the server refused', async () => {
    const outcome = await keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto: join(folder, 'film.mp4'),
      already: 0,
      fetching: answering(new Response('no', { status: 404 })),
      report: () => {},
    }).finished;

    expect(outcome).toEqual({ bytes: 0, isComplete: false, failure: 'The server answered 404.' });
  });

  it('treats being stopped as unfinished rather than as failed', async () => {
    const fetching = keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto: join(folder, 'film.mp4'),
      already: 0,
      fetching: answering(
        new Response(streamOf(['a', 'b', 'c', 'd', 'e'], 20), {
          headers: { 'content-length': '5' },
        }),
      ),
      report: () => {},
    });

    await new Promise((carryOn) => setTimeout(carryOn, 30));

    fetching.stop();

    const outcome = await fetching.finished;

    expect([outcome.isComplete, outcome.failure]).toEqual([false, null]);
  });

  it('keeps what it managed to fetch, because that is where the next attempt starts', async () => {
    const onto = join(folder, 'film.mp4');

    const fetching = keepADownload({
      from: 'https://valence.test/api/downloads/one/file',
      onto,
      already: 0,
      fetching: answering(
        new Response(streamOf(['a', 'b', 'c', 'd', 'e'], 20), {
          headers: { 'content-length': '5' },
        }),
      ),
      report: () => {},
    });

    await new Promise((carryOn) => setTimeout(carryOn, 50));

    fetching.stop();

    const outcome = await fetching.finished;

    expect(outcome.bytes).toBeGreaterThan(0);
    await expect(readFile(onto, 'utf8')).resolves.toHaveLength(outcome.bytes);
  });
});
