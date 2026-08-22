import type { MoodLight } from '@ValenceUI/MoodBackground.types';

const READ_AT = 24;

const SPREAD = 1.9;

const ZONES = [
  { from: [0, 0, 0.5, 0.5], at: '12% 10%' },
  { from: [0.5, 0, 0.5, 0.5], at: '88% 12%' },
  { from: [0, 0.5, 0.5, 0.5], at: '10% 82%' },
  { from: [0.5, 0.5, 0.5, 0.5], at: '90% 85%' },
  { from: [0.25, 0.25, 0.5, 0.5], at: '50% 45%' },
] as const;

const MIN_PEAK = 110;

/**
 * Reads the handful of colours that stand for an image, by drawing it very small and looking at what
 * is left. Shrinking averages the picture for us, which is both cheaper and steadier than sampling a
 * full-size one. Answers with nothing where the image cannot be read at all, which a canvas tainted
 * by another origin cannot.
 *
 * @param source - The image to read.
 * @returns The colours to light a page with, or none where it could not be read.
 */
const readLights = (source: CanvasImageSource): MoodLight[] => {
  try {
    const canvas = document.createElement('canvas');

    canvas.width = READ_AT;
    canvas.height = READ_AT;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (context === null) {
      return [];
    }

    context.drawImage(source, 0, 0, READ_AT, READ_AT);

    const lights: MoodLight[] = [];

    for (const zone of ZONES) {
      const [left, top, width, height] = zone.from;
      const patch = context.getImageData(
        Math.floor(left * READ_AT),
        Math.floor(top * READ_AT),
        Math.max(1, Math.floor(width * READ_AT)),
        Math.max(1, Math.floor(height * READ_AT)),
      ).data;

      let red = 0;
      let green = 0;
      let blue = 0;
      let counted = 0;

      for (let at = 0; at < patch.length; at += 4) {
        red += patch[at] ?? 0;
        green += patch[at + 1] ?? 0;
        blue += patch[at + 2] ?? 0;
        counted += 1;
      }

      if (counted === 0) {
        continue;
      }

      const lift = (channel: number): number => {
        const average = (red + green + blue) / (counted * 3);
        const own = channel / counted;

        return Math.max(0, Math.min(255, Math.round(average + (own - average) * SPREAD)));
      };

      const read = [lift(red), lift(green), lift(blue)];
      const peak = Math.max(...read);
      const scale = peak === 0 || peak >= MIN_PEAK ? 1 : MIN_PEAK / peak;
      const [litRed = 0, litGreen = 0, litBlue = 0] = read.map((channel) =>
        Math.min(255, Math.round(channel * scale)),
      );

      lights.push({
        at: zone.at,
        color: `rgb(${litRed.toString()} ${litGreen.toString()} ${litBlue.toString()})`,
      });
    }

    return lights;
  } catch {
    return [];
  }
};

export { readLights, READ_AT, ZONES };
