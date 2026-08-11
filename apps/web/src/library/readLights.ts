import type { MoodLight } from '@FluxUI/MoodBackground.types';

/**
 * How big a picture is read at.
 *
 * Tiny on purpose. What is wanted is the colour of each corner of a picture,
 * and that survives being shrunk to a thumbnail — where reading every pixel of
 * a 4K frame would cost more than drawing the page.
 */
const READ_AT = 24;

/**
 * How far a region's colour is pushed from grey before it is used.
 *
 * An average is duller than what it averages, and five dull averages light a
 * page in five browns. Pushing each channel away from its own mean gives back
 * roughly what somebody would say the corner of the picture was.
 */
const SPREAD = 1.9;

/**
 * Where a frame is read, and where the light from each part of it belongs.
 *
 * A picture is not one colour, and neither is the light coming off a screen
 * showing it: a red coat on the left throws red on the left. Each zone is read
 * on its own and lights the page from the place it came from, which is what
 * makes it read as spill rather than as a tint.
 */
const ZONES = [
  { from: [0, 0, 0.5, 0.5], at: '12% 10%' },
  { from: [0.5, 0, 0.5, 0.5], at: '88% 12%' },
  { from: [0, 0.5, 0.5, 0.5], at: '10% 82%' },
  { from: [0.5, 0.5, 0.5, 0.5], at: '90% 85%' },
  { from: [0.25, 0.25, 0.5, 0.5], at: '50% 45%' },
] as const;

/**
 * The light coming off a picture, part by part.
 *
 * Done here rather than on the server because it is a question about this
 * moment. A server deciding it at import decides it once, for every screen,
 * from a frame nobody was looking at yet.
 *
 *
 * Each corner and the middle are averaged on their own, so what is thrown onto
 * the page comes from the place it belongs to. Averaged rather than counted:
 * for light, the colour of a region is what it looks like from across a room,
 * and that is its average.
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

      // Pushed away from grey before it is used. The average of a region is
      // duller than the region looks, and a page lit by five averages is a page
      // lit by five browns.
      const lift = (channel: number): number => {
        const average = (red + green + blue) / (counted * 3);
        const own = channel / counted;

        return Math.max(0, Math.min(255, Math.round(average + (own - average) * SPREAD)));
      };

      lights.push({
        at: zone.at,
        color: `rgb(${lift(red).toString()} ${lift(green).toString()} ${lift(blue).toString()})`,
      });
    }

    return lights;
  } catch {
    // A frame that cannot be read — a video that has not decoded one yet, or a
    // picture from somewhere that will not allow it. Either way the page keeps
    // the light it already had.
    return [];
  }
};

export { readLights, READ_AT, ZONES };
