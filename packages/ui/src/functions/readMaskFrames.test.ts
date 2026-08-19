import { describe, expect, it } from 'vitest';
import { readMaskFrames } from './readMaskFrames';

/**
 * Writes frames of bits as the packed mask the reader expects, so that the tests describe pictures
 * rather than bytes.
 *
 * @param frames - Each frame's bits, in row order.
 * @param width - How many pixels across one frame is.
 * @param height - How many pixels down one frame is.
 * @param fps - How many frames there are to a second.
 * @returns The packed mask.
 */
const packedOf = (frames: number[][], width: number, height: number, fps: number): Uint8Array => {
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

  header.setUint16(0, width, true);
  header.setUint16(2, height, true);
  header.setUint32(4, frames.length, true);
  header.setUint16(8, fps, true);
  packed.set(bytes, 10);

  return packed;
};

const DARK = Array.from({ length: 9 }, () => 0);

const LIT = Array.from({ length: 9 }, () => 1);

const HALF = [1, 1, 1, 0, 0, 0, 0, 0, 0];

describe('readMaskFrames', () => {
  it('reads the shape of the mask off the front of it', () => {
    const mask = readMaskFrames(packedOf([DARK], 3, 3, 30));

    expect(mask.width).toBe(3);
    expect(mask.height).toBe(3);
    expect(mask.frames).toBe(1);
    expect(mask.fps).toBe(30);
  });

  it('reads a frame back exactly as it was written', () => {
    const mask = readMaskFrames(packedOf([HALF], 3, 3, 30));

    expect([...mask.at(0)]).toStrictEqual(HALF);
  });

  it('reads a frame that is dark end to end', () => {
    const mask = readMaskFrames(packedOf([DARK], 3, 3, 30));

    expect([...mask.at(0)]).toStrictEqual(DARK);
  });

  it('reads a frame that is lit end to end', () => {
    const mask = readMaskFrames(packedOf([LIT], 3, 3, 30));

    expect([...mask.at(0)]).toStrictEqual(LIT);
  });

  it('reads one frame after another, which is how a film is watched', () => {
    const mask = readMaskFrames(packedOf([DARK, HALF, LIT], 3, 3, 30));

    expect([...mask.at(0)]).toStrictEqual(DARK);
    expect([...mask.at(1)]).toStrictEqual(HALF);
    expect([...mask.at(2)]).toStrictEqual(LIT);
  });

  it('skips forward without being asked for everything in between', () => {
    const mask = readMaskFrames(packedOf([DARK, HALF, LIT], 3, 3, 30));

    expect([...mask.at(2)]).toStrictEqual(LIT);
  });

  it('goes back to the start when it is asked to, rather than reading past the end', () => {
    const mask = readMaskFrames(packedOf([DARK, HALF, LIT], 3, 3, 30));

    expect([...mask.at(2)]).toStrictEqual(LIT);
    expect([...mask.at(0)]).toStrictEqual(DARK);
    expect([...mask.at(1)]).toStrictEqual(HALF);
  });

  it('holds on the frame it is showing rather than reading it again', () => {
    const mask = readMaskFrames(packedOf([HALF, LIT], 3, 3, 30));

    expect([...mask.at(1)]).toStrictEqual(LIT);
    expect([...mask.at(1)]).toStrictEqual(LIT);
  });

  it('holds on the last frame rather than running off the end of the film', () => {
    const mask = readMaskFrames(packedOf([DARK, LIT], 3, 3, 30));

    expect([...mask.at(99)]).toStrictEqual(LIT);
  });

  it('holds on the first frame rather than being asked for one before it', () => {
    const mask = readMaskFrames(packedOf([HALF, LIT], 3, 3, 30));

    expect([...mask.at(-5)]).toStrictEqual(HALF);
  });

  it('reads a run too long to fit in one byte', () => {
    const wide = Array.from({ length: 400 }, (_, at) => (at < 200 ? 0 : 1));
    const mask = readMaskFrames(packedOf([wide], 20, 20, 30));

    expect([...mask.at(0)]).toStrictEqual(wide);
  });
});
