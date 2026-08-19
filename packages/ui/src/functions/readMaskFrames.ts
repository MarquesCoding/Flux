import type { MaskFrames } from '@FluxUI/MaskFrames.types';

const HEADER = 10;

/**
 * Reads a packed mask back a frame at a time. It reads forwards and keeps its place, because a film
 * is watched from its start to its end: asking for the next frame costs only the runs that frame is
 * made of, and nothing is held in memory but the one frame being shown.
 *
 * @param packed - The mask, as written by the tool that builds it.
 * @returns The mask's shape, and a way to ask it for a frame.
 */
const readMaskFrames = (packed: Uint8Array): MaskFrames => {
  const header = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  const width = header.getUint16(0, true);
  const height = header.getUint16(2, true);
  const frames = header.getUint32(4, true);
  const fps = header.getUint16(8, true);
  const size = width * height;
  const held = new Uint8Array(size);

  let cursor = HEADER;
  let read = 0;

  /**
   * Reads the runs of one more frame over the frame before it.
   */
  const step = (): void => {
    let at = 0;
    let lit = 0;

    while (at < size) {
      let run = 0;
      let shift = 0;
      let byte = 0;

      do {
        byte = packed[cursor] ?? 0;
        cursor += 1;
        run |= (byte & 127) << shift;
        shift += 7;
      } while ((byte & 128) !== 0);

      const to = Math.min(size, at + run);

      held.fill(lit, at, to);
      at = to;
      lit = lit === 0 ? 1 : 0;
    }

    read += 1;
  };

  return {
    width,
    height,
    frames,
    fps,
    at: (frame: number): Uint8Array => {
      const wanted = Math.min(Math.max(frame, 0), frames - 1);

      if (wanted < read - 1) {
        cursor = HEADER;
        read = 0;
      }

      while (read <= wanted) {
        step();
      }

      return held;
    },
  };
};

export { readMaskFrames };
