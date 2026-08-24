import { z } from 'zod';
import { platformInUse } from '@ValenceClient/platform/installPlatform';

const STORAGE_KEY = 'valence.theme';

const THEMES = ['system', 'light', 'dark'] as const;

const ThemeSchema = z.enum(THEMES).catch('system');

type Theme = (typeof THEMES)[number];

const listeners = new Set<(theme: Theme) => void>();

/**
 * Which theme somebody has asked for, or that they have not asked.
 *
 * Three answers rather than two, because "follow the machine" is a real choice and not the absence
 * of one. Somebody who has set their laptop to turn dark in the evening has already said what they
 * want; an application that made them say it again, and then ignored the laptop, would be worse than
 * one that never asked.
 *
 * @returns What was chosen.
 */
const chosenTheme = (): Theme => ThemeSchema.parse(platformInUse().store.read(STORAGE_KEY));

/**
 * Remembers a theme and tells whoever is drawing with it.
 *
 * Only remembered here. Putting it on the document is drawing, and this package does not draw — see
 * `applyTheme`, which is the screens' half of the same idea.
 *
 * @param theme - What was chosen.
 */
const chooseTheme = (theme: Theme): void => {
  const { store } = platformInUse();

  if (theme === 'system') {
    store.forget(STORAGE_KEY);
  } else {
    store.write(STORAGE_KEY, theme);
  }

  for (const listener of listeners) {
    listener(theme);
  }
};

/**
 * Watches for the theme being changed.
 *
 * @param listener - Told whenever it changes.
 * @returns A way to stop listening.
 */
const whenThemeChanges = (listener: (theme: Theme) => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/**
 * Reads whatever a control handed back as a theme.
 *
 * A segmented control answers with the id of what was pressed, which is a string as far as its type
 * is concerned. Anything unrecognised is read as following the machine, which is the answer that
 * cannot be wrong.
 *
 * @param said - What was chosen.
 * @returns The theme.
 */
const readTheme = (said: string): Theme => ThemeSchema.parse(said);

export type { Theme };

export { STORAGE_KEY, THEMES, chooseTheme, chosenTheme, readTheme, whenThemeChanges };
