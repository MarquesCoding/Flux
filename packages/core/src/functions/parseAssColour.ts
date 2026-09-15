type AssColour = {
  colour: string;
  opacity: number | null;
};

const HEX = /^&H([0-9a-f]{1,8})&?$/i;

/**
 * Reads a colour as Advanced SubStation writes it, which is neither the order nor the direction
 * anything else uses.
 *
 * The channels run backwards — `&H00FFAA00` is `AABBGGRR`, so that is blue `00`, green `AA`, red
 * `FF` — and the first pair is transparency rather than opacity, counting up from `00` meaning fully
 * opaque. Six digits name a colour with nothing to say about how solid it is; eight say both. Very
 * old scripts write the same number in decimal.
 *
 * @param raw - The colour as the script wrote it.
 * @returns The colour as CSS spells it and how opaque it is, or null where it is not a colour.
 */
const parseAssColour = (raw: string): AssColour | null => {
  const trimmed = raw.trim();
  const found = HEX.exec(trimmed);

  const digits =
    found === null
      ? /^\d+$/.test(trimmed)
        ? Number(trimmed).toString(16).padStart(6, '0')
        : null
      : (found[1] ?? '').padStart(6, '0');

  if (digits === null || digits.length > 8) {
    return null;
  }

  const padded = digits.padStart(8, '0');
  const transparency = padded.slice(0, 2);
  const blue = padded.slice(2, 4);
  const green = padded.slice(4, 6);
  const red = padded.slice(6, 8);

  return {
    colour: `#${red}${green}${blue}`.toLowerCase(),
    opacity: digits.length > 6 ? 1 - Number.parseInt(transparency, 16) / 255 : null,
  };
};

/**
 * Reads a transparency on its own, as the `\alpha` override carries it, counting up from `00`
 * meaning fully opaque.
 *
 * @param raw - The transparency as the script wrote it.
 * @returns How opaque it is, or null where it is not a transparency.
 */
const parseAssAlpha = (raw: string): number | null => {
  const found = HEX.exec(raw.trim());

  if (found === null) {
    return null;
  }

  return 1 - Number.parseInt((found[1] ?? '').slice(-2).padStart(2, '0'), 16) / 255;
};

export type { AssColour };

export { parseAssAlpha, parseAssColour };
