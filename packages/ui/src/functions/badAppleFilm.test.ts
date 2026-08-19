import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBadAppleFilm } from './badAppleFilm';

const WIDTH = 4;

const HEIGHT = 3;

/**
 * Serves a mask of the given frames, gzipped, in place of the one that ships.
 *
 * @param frames - Each frame's bits, in row order.
 */
const serve = (frames: number[][]) => {
  const runs: number[] = [];

  for (const frame of frames) {
    let lit = 0;
    let run = 0;

    for (const bit of frame) {
      if (bit === lit) {
        run += 1;
      } else {
        runs.push(run);
        lit = bit;
        run = 1;
      }
    }

    runs.push(run);
  }

  const bytes: number[] = [];

  for (const run of runs) {
    let left = run;

    while (left >= 128) {
      bytes.push((left & 127) | 128);
      left >>>= 7;
    }

    bytes.push(left);
  }

  const packed = new Uint8Array(10 + bytes.length);
  const header = new DataView(packed.buffer);

  header.setUint16(0, WIDTH, true);
  header.setUint16(2, HEIGHT, true);
  header.setUint32(4, frames.length, true);
  header.setUint16(8, 30, true);
  packed.set(bytes, 10);

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(gzipSync(packed)))));
};

const LEFT = [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0];

const DARK = Array.from({ length: WIDTH * HEIGHT }, () => 0);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadBadAppleFilm', () => {
  it('knows how long the film runs for, from the frames it holds', async () => {
    serve([DARK, DARK, DARK]);

    const film = await loadBadAppleFilm();

    expect(film.seconds).toBeCloseTo(0.1);
  });

  it('draws the frame the moment asks for', async () => {
    serve([DARK, LEFT]);

    const film = await loadBadAppleFilm();
    const lifts = new Float32Array(4 * 3);

    film.lift(lifts, 4, 3, 0);
    expect(lifts.some((lift) => lift > 0)).toBe(false);

    film.lift(lifts, 4, 3, 1 / 30);
    expect(lifts.some((lift) => lift > 0)).toBe(true);
  });

  it('puts the picture where the mask put it rather than mirroring it', async () => {
    serve([LEFT]);

    const film = await loadBadAppleFilm();
    const lifts = new Float32Array(4 * 3);

    film.lift(lifts, 4, 3, 0);

    expect(lifts[0]).toBe(1);
    expect(lifts[3]).toBe(0);
  });

  it('leaves the dots either side dark rather than stretching the picture over them', async () => {
    serve([Array.from({ length: WIDTH * HEIGHT }, () => 1)]);

    const film = await loadBadAppleFilm();
    const lifts = new Float32Array(40 * 3);

    film.lift(lifts, 40, 3, 0);

    expect(lifts[0]).toBe(0);
    expect(lifts[39]).toBe(0);
    expect(lifts[20]).toBe(1);
  });

  it('holds on the last frame rather than running off the end of the film', async () => {
    serve([DARK, Array.from({ length: WIDTH * HEIGHT }, () => 1)]);

    const film = await loadBadAppleFilm();
    const lifts = new Float32Array(4 * 3);

    film.lift(lifts, 4, 3, 500);

    expect(lifts.every((lift) => lift === 1)).toBe(true);
  });

  it('survives a grid one dot tall rather than dividing by nothing', async () => {
    serve([LEFT]);

    const film = await loadBadAppleFilm();
    const lifts = new Float32Array(4);

    film.lift(lifts, 4, 1, 0);

    expect(lifts.every((lift) => Number.isFinite(lift))).toBe(true);
  });

  it('says so rather than hanging when the mask comes back with nothing in it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ body: null }));

    await expect(loadBadAppleFilm()).rejects.toThrow('empty');
  });
});
