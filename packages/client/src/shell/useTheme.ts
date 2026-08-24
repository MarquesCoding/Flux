import { useCallback, useEffect, useState } from 'react';
import { chooseTheme, chosenTheme, whenThemeChanges } from '@ValenceClient/shell/theme';
import type { Theme } from '@ValenceClient/shell/theme';

type ThemeChoice = {
  theme: Theme;
  choose: (theme: Theme) => void;
};

/**
 * Which theme is in force, and how to change it.
 *
 * @returns The chosen theme and the way to choose another.
 */
const useTheme = (): ThemeChoice => {
  const [theme, setTheme] = useState(chosenTheme);

  useEffect(() => whenThemeChanges(setTheme), []);

  const choose = useCallback((chosen: Theme) => {
    chooseTheme(chosen);
  }, []);

  return { theme, choose };
};

export type { ThemeChoice };

export { useTheme };
