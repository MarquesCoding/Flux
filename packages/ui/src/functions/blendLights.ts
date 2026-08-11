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
 * Moves the light the page is under part of the way towards what is on screen
 * now.
 *
 * A frame is read several times a second, and a cut, a muzzle flash or a pan
 * across a lamp changes what comes back from one reading to the next. Handing
 * every reading straight to the page is what makes a wash flicker: it is
 * showing the film's own frame rate rather than the room the film is in.
 *
 * So each reading only pulls the current light a fraction of the way towards
 * it. A colour that holds for a second or so arrives in full; one that lasts a
 * single frame barely registers. This is done in numbers rather than left to
 * the browser because a gradient is not something it will reliably carry from
 * one colour to another, and a wash that steps between colours is the thing
 * being fixed.
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
