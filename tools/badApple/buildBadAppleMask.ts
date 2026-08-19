import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packMaskFrames } from './packMaskFrames';

const WIDTH = 128;

const HEIGHT = 96;

const FPS = 30;

const LEVEL = 128;

const INTO = resolve(import.meta.dirname, '../../packages/ui/src/assets/badApple.bin');

/**
 * Reads a film through FFmpeg as plain greyscale pixels at the size the dots want, which is the
 * only thing this needs from it — the mask is one bit a dot, so everything a video container knows
 * about colour, sound and timing is thrown away here.
 *
 * @param from - The film to read.
 * @returns Every frame's pixels, one byte each.
 */
const greyFramesOf = (from: string): Uint8Array =>
  new Uint8Array(
    execFileSync(
      process.env['FLUX_FFMPEG'] ?? 'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        from,
        '-an',
        '-vf',
        `scale=${WIDTH.toString()}:${HEIGHT.toString()}:flags=area,format=gray`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'gray',
        'pipe:1',
      ],
      { maxBuffer: 1024 * 1024 * 1024 },
    ),
  );

/**
 * Builds the mask the background dots play, from a film given on the command line. The film itself
 * is not in this repository and this is not run by the build: it is run by hand when the mask needs
 * making again, and the mask it writes is what ships.
 */
const buildBadAppleMask = (): void => {
  const from = process.argv[2];

  if (from === undefined) {
    throw new Error('Give this the film to build the mask from.');
  }

  const grey = greyFramesOf(from);
  const packed = packMaskFrames(grey, WIDTH, HEIGHT, FPS, LEVEL);
  const squashed = gzipSync(packed, { level: 9 });

  writeFileSync(INTO, squashed);

  const frames = Math.floor(grey.length / (WIDTH * HEIGHT));

  process.stdout.write(
    `${frames.toString()} frames at ${WIDTH.toString()}x${HEIGHT.toString()}, ` +
      `${(packed.length / 1024).toFixed(0)}KB packed, ` +
      `${(squashed.length / 1024).toFixed(0)}KB written\n`,
  );
};

buildBadAppleMask();
