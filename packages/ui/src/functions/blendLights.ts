import type { MoodLight } from '@ValenceUI/MoodBackground.types';

/**
 * Reads an `rgb()` colour as its three channels, which is the only form it can be averaged in.
 * Anything else — a hex code, a named colour, a gradient — comes back as nothing rather than as a
 * guess, and leaves the light it came from alone.
 *
 * @param colour - The colour as CSS wrote it.
 * @returns The red, green and blue channels, or null where the colour was not in that form.
 */
const readColour = (colour: string): [number, number, number] | null => {
  const found = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)/.exec(colour);

  if (found === null) {
    return null;
  }

  return [Number(found[1]), Number(found[2]), Number(found[3])];
};

/**
 * Moves the light the page is lit by part of the way towards the light of whatever is on screen
 * now, so that changing what is featured warms the room rather than switching it. A light that
 * cannot be read is passed through untouched rather than being blended into grey.
 *
 * @param from - The lights currently in force.
 * @param to - The lights being moved towards.
 * @param amount - How far to move, from nothing to all the way.
 * @returns The lights to paint this frame.
 */
const blendLights = (from: MoodLight[], to: MoodLight[], amount: number): MoodLight[] =>
  to.map((light, at) => {
    const held = readColour(from[at]?.color ?? '');
    const wanted = readColour(light.color);

    if (held === null || wanted === null) {
      return light;
    }

    const [red, green, blue] = [0, 1, 2].map((channel) =>
      Math.round((held[channel] ?? 0) + ((wanted[channel] ?? 0) - (held[channel] ?? 0)) * amount),
    );

    return {
      ...light,
      color: `rgb(${(red ?? 0).toString()} ${(green ?? 0).toString()} ${(blue ?? 0).toString()})`,
    };
  });

export { blendLights };
