const HEADER = 10;

/**
 * Writes one number as a varint, seven bits to a byte, so that a short run costs one byte and a
 * long one costs only as many as it needs. Runs are overwhelmingly short, so a fixed width would
 * spend most of the file on leading zeroes.
 *
 * @param into - The bytes being built.
 * @param value - The number to write.
 */
const putVarint = (into: number[], value: number): void => {
  let left = value;

  while (left >= 128) {
    into.push((left & 127) | 128);
    left >>>= 7;
  }

  into.push(left);
};

/**
 * Turns greyscale frames into the run-length stream the dots read back. Every frame is a series of
 * runs that alternate dark, light, dark, starting dark and always summing to one frame, which is
 * what lets the reader tell where one frame ends without being told how long it is.
 *
 * @param grey - Every frame's pixels, one byte each, one frame after another.
 * @param width - How many pixels across one frame is.
 * @param height - How many pixels down one frame is.
 * @param fps - How many frames there are to a second.
 * @param level - The brightness at which a pixel counts as lit.
 * @returns The stream, with its header.
 */
const packMaskFrames = (
  grey: Uint8Array,
  width: number,
  height: number,
  fps: number,
  level: number,
): Uint8Array => {
  const size = width * height;
  const frames = Math.floor(grey.length / size);
  const runs: number[] = [];

  for (let frame = 0; frame < frames; frame += 1) {
    const from = frame * size;
    let lit = 0;
    let run = 0;

    for (let at = 0; at < size; at += 1) {
      const now = (grey[from + at] ?? 0) >= level ? 1 : 0;

      if (now === lit) {
        run += 1;
      } else {
        putVarint(runs, run);
        lit = now;
        run = 1;
      }
    }

    putVarint(runs, run);
  }

  const packed = new Uint8Array(HEADER + runs.length);
  const header = new DataView(packed.buffer);

  header.setUint16(0, width, true);
  header.setUint16(2, height, true);
  header.setUint32(4, frames, true);
  header.setUint16(8, fps, true);
  packed.set(runs, HEADER);

  return packed;
};

export { packMaskFrames };
