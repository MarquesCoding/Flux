import type { CSSProperties } from 'react';
import type { SubtitleSpan } from '@ValenceClient/playback/fetchSubtitleCues';

const KNOWN_FONTS: Record<string, string> = {
  arial: 'Arial, Helvetica, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  impact: 'Impact, Haettenschweiler, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Geneva, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  'times new roman': '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
  'courier new': '"Courier New", Courier, monospace',
  'comic sans ms': '"Comic Sans MS", cursive',
  'trebuchet ms': '"Trebuchet MS", Helvetica, sans-serif',
};

const SMALLEST = 0.01;

const LARGEST = 0.5;

/**
 * Turns what a script dressed a run of text in into the properties that draw it.
 *
 * Nothing goes through as written. A font name picks from the faces known to be installed rather
 * than becoming an arbitrary `font-family`, a size is clamped to something that can still be read
 * and cannot cover the picture, and a colour has already been parsed to six hex digits before it
 * arrives. These files come from whatever produced the media, and a subtitle is worth reading rather
 * than obeying.
 *
 * The size is a fraction of the picture's height, drawn in container units so that a line keeps its
 * proportions whether the player is filling the screen or sitting in a corner of the page.
 *
 * @param span - The run of text.
 * @returns The properties that draw it.
 */
const toSpanStyle = (span: SubtitleSpan): CSSProperties => {
  const face = KNOWN_FONTS[(span.fontFamily ?? '').trim().toLowerCase()];
  const height =
    span.fontHeight === null ? null : Math.min(Math.max(span.fontHeight, SMALLEST), LARGEST);

  return {
    ...(face === undefined ? {} : { fontFamily: face }),
    ...(height === null ? {} : { fontSize: `${(height * 100).toString()}cqh` }),
    ...(span.colour === null ? {} : { color: span.colour }),
    ...(span.opacity === null ? {} : { opacity: Math.min(Math.max(span.opacity, 0), 1) }),
    fontWeight: span.isBold ? 700 : 400,
    fontStyle: span.isItalic ? 'italic' : 'normal',
    ...(span.isUnderlined || span.isStruckThrough
      ? {
          textDecorationLine: [
            span.isUnderlined ? 'underline' : '',
            span.isStruckThrough ? 'line-through' : '',
          ]
            .filter((one) => one !== '')
            .join(' '),
        }
      : {}),
  };
};

export { KNOWN_FONTS, LARGEST, SMALLEST, toSpanStyle };
