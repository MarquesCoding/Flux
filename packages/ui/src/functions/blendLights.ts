import type { MoodLight } from '@FluxUI/MoodBackground.types';

/**
 * A colour as three numbers, which is the only form it can be averaged in.
 */
const readColour = (colour: string): [number, number, number] | null => {
  const found = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)/.exec(colour);

  if (found === null) {
    return null;
  }

  return [Number(found[1]), Number(found[2]), Number(found[3])];
};

/**
 * Moves the light the page is under part of the way towards what is on screen now.
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
