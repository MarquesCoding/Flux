const READ_AT = 32;

const DARK_BELOW = 0.4;

const DRAWN_FROM = 128;

/**
 * Says whether the marks in an image are dark — whether, laid over a dark picture, they would all
 * but disappear. Only what is drawn is counted: the transparent ground around a title's lettering
 * says nothing about the lettering. Answers no where the image cannot be read, which leaves it drawn
 * as it is rather than guessed at.
 *
 * @param source - The image, already loaded.
 * @returns Whether its drawn parts are dark.
 */
const isDarkInk = (source: CanvasImageSource): boolean => {
  try {
    const canvas = document.createElement('canvas');

    canvas.width = READ_AT;
    canvas.height = READ_AT;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (context === null) {
      return false;
    }

    context.drawImage(source, 0, 0, READ_AT, READ_AT);

    const pixels = context.getImageData(0, 0, READ_AT, READ_AT).data;

    let lightness = 0;
    let drawn = 0;

    for (let at = 0; at < pixels.length; at += 4) {
      if ((pixels[at + 3] ?? 0) < DRAWN_FROM) {
        continue;
      }

      lightness +=
        (0.2126 * (pixels[at] ?? 0) +
          0.7152 * (pixels[at + 1] ?? 0) +
          0.0722 * (pixels[at + 2] ?? 0)) /
        255;
      drawn += 1;
    }

    return drawn > 0 && lightness / drawn < DARK_BELOW;
  } catch {
    return false;
  }
};

export { isDarkInk };
