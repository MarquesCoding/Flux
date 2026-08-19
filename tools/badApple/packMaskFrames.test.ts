import { describe, expect, it } from 'vitest';
import { packMaskFrames } from './packMaskFrames';

const greyOf = (values: number[]): Uint8Array => new Uint8Array(values);

const headerOf = (packed: Uint8Array) => {
  const header = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);

  return {
    width: header.getUint16(0, true),
    height: header.getUint16(2, true),
    frames: header.getUint32(4, true),
    fps: header.getUint16(8, true),
  };
};

describe('packMaskFrames', () => {
  it('writes the shape of the mask on the front of it', () => {
    const packed = packMaskFrames(greyOf([0, 0, 0, 0]), 2, 2, 30, 128);

    expect(headerOf(packed)).toStrictEqual({ width: 2, height: 2, frames: 1, fps: 30 });
  });

  it('counts the frames it was given rather than being told', () => {
    const packed = packMaskFrames(greyOf(Array.from({ length: 12 }, () => 0)), 2, 2, 30, 128);

    expect(headerOf(packed).frames).toBe(3);
  });

  it('writes a frame that never changes as a single run', () => {
    const packed = packMaskFrames(greyOf([0, 0, 0, 0]), 2, 2, 30, 128);

    expect(packed).toHaveLength(11);
    expect(packed[10]).toBe(4);
  });

  it('starts every frame from dark, so a frame that opens lit begins with an empty run', () => {
    const packed = packMaskFrames(greyOf([255, 255, 255, 255]), 2, 2, 30, 128);

    expect(Array.from(packed.slice(10))).toStrictEqual([0, 4]);
  });

  it('splits a frame at the point the picture changes', () => {
    const packed = packMaskFrames(greyOf([0, 0, 255, 255]), 2, 2, 30, 128);

    expect(Array.from(packed.slice(10))).toStrictEqual([2, 2]);
  });

  it('takes the level it was given as the point a pixel counts as lit', () => {
    const dim = packMaskFrames(greyOf([100, 100, 100, 100]), 2, 2, 30, 200);
    const bright = packMaskFrames(greyOf([100, 100, 100, 100]), 2, 2, 30, 50);

    expect(Array.from(dim.slice(10))).toStrictEqual([4]);
    expect(Array.from(bright.slice(10))).toStrictEqual([0, 4]);
  });

  it('writes a run too long for one byte as more than one', () => {
    const packed = packMaskFrames(greyOf(Array.from({ length: 400 }, () => 0)), 20, 20, 30, 128);

    expect(Array.from(packed.slice(10))).toStrictEqual([144, 3]);
  });

  it('drops a part frame at the end rather than writing a torn one', () => {
    const packed = packMaskFrames(greyOf(Array.from({ length: 7 }, () => 0)), 2, 2, 30, 128);

    expect(headerOf(packed).frames).toBe(1);
  });
});
