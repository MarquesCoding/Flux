import { z } from 'zod';

const FONT_FAMILIES = {
  sans: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  casual: '"Comic Sans MS", "Chalkboard SE", cursive',
} as const;

/**
 * The edge drawn behind the lettering, at a given strength.
 */
const edgeStyle = (edge: CaptionStyle['edgeStyle'], opacity: number): string => {
  const ink = (strength: number): string => `rgba(0, 0, 0, ${(strength * opacity).toFixed(2)})`;

  if (edge === 'none') {
    return 'none';
  }

  if (edge === 'shadow') {
    return `2px 2px 4px ${ink(0.9)}`;
  }

  if (edge === 'raised') {
    return `1px 1px 0 rgba(255, 255, 255, ${(0.4 * opacity).toFixed(2)}), 2px 2px 3px ${ink(0.9)}`;
  }

  return [
    `-1px -1px 0 ${ink(1)}`,
    `1px -1px 0 ${ink(1)}`,
    `-1px 1px 0 ${ink(1)}`,
    `1px 1px 0 ${ink(1)}`,
    `0 0 3px ${ink(0.9)}`,
  ].join(', ');
};

const CaptionStyleSchema = z.object({
  fontFamily: z.enum(['sans', 'serif', 'mono', 'casual']).default('sans'),
  fontScale: z.number().min(50).max(300).default(100),
  color: z.string().default('#ffffff'),
  opacity: z.number().min(0.1).max(1).default(1),
  backgroundColor: z.string().default('#000000'),
  backgroundOpacity: z.number().min(0).max(1).default(0.75),
  edgeStyle: z.enum(['none', 'outline', 'shadow', 'raised']).default('outline'),
});

type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

const STORAGE_KEY = 'flux.captionStyle';

const DEFAULT_CAPTION_STYLE: CaptionStyle = CaptionStyleSchema.parse({});

/**
 * Turns a hex colour and an opacity into something CSS accepts.
 */
const withOpacity = (color: string, opacity: number): string => {
  const hex = color.replace('#', '');
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : hex;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) {
    return color;
  }

  return `rgba(${red.toString()}, ${green.toString()}, ${blue.toString()}, ${opacity.toString()})`;
};

type CueDeclarations = {
  fontFamily: string;
  fontSize: string;
  color: string;
  backgroundColor: string;
  textShadow: string;
};

/**
 * A caption style as the properties that draw it.
 */
const toCueDeclarations = (style: CaptionStyle): CueDeclarations => ({
  fontFamily: FONT_FAMILIES[style.fontFamily],
  fontSize: `${style.fontScale.toString()}%`,
  color: withOpacity(style.color, style.opacity),
  backgroundColor: withOpacity(style.backgroundColor, style.backgroundOpacity),
  textShadow: edgeStyle(style.edgeStyle, style.opacity),
});

/**
 * Writes a caption style as the CSS that renders it.
 */
const toCueCss = (style: CaptionStyle): string => {
  const declarations = toCueDeclarations(style);

  return [
    `font-family: ${declarations.fontFamily};`,
    `font-size: ${declarations.fontSize};`,
    `color: ${declarations.color};`,
    `background-color: ${declarations.backgroundColor};`,
    `text-shadow: ${declarations.textShadow};`,
  ].join(' ');
};

/**
 * Reads a viewer's caption preferences.
 */
const readCaptionStyle = (): CaptionStyle => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
      return DEFAULT_CAPTION_STYLE;
    }

    const parsed = CaptionStyleSchema.safeParse(JSON.parse(stored));

    return parsed.success ? parsed.data : DEFAULT_CAPTION_STYLE;
  } catch {
    return DEFAULT_CAPTION_STYLE;
  }
};

/**
 * Remembers a viewer's caption preferences.
 */
const saveCaptionStyle = (style: CaptionStyle): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
  } catch {}
};

export type { CaptionStyle };

export {
  DEFAULT_CAPTION_STYLE,
  edgeStyle,
  STORAGE_KEY,
  toCueCss,
  toCueDeclarations,
  withOpacity,
  readCaptionStyle,
  saveCaptionStyle,
};
