import { useLayoutEffect, useRef } from 'react';
import { useTheme } from '@ValenceClient/shell/useTheme';
import { applyTheme } from '@ValenceScreens/theme/applyTheme';
import { revealTheme } from '@ValenceScreens/theme/revealTheme';
import type { Theme } from '@ValenceClient/shell/theme';

/**
 * Keeps the document marked with whatever theme is in force, for as long as the caller is drawn.
 *
 * Called by every outermost thing there is, of which there is more than one. The application has a
 * root that both of its shapes pass through, but a client with a window of its own draws a screen
 * before that root exists — which server is yours — and a screen outside the application is still a
 * screen somebody looks at. Marked in only one of the two places, a viewer who asked for dark on a
 * light machine met a light screen and watched it turn as they went in.
 *
 * Before the browser paints rather than after. Applied after, the machine's preference is shown for
 * a frame first, which is the flash everybody recognises.
 *
 * The first theme is put on at once; a theme changed afterwards eases from the one to the other.
 * Only a change is eased — the page arriving in the theme it was left in is not an event, and easing
 * it would mean every load began in the wrong colours and corrected itself.
 */
const useAppliedTheme = (): void => {
  const { theme } = useTheme();
  const appliedRef = useRef<Theme | null>(null);

  useLayoutEffect(() => {
    const before = appliedRef.current;

    appliedRef.current = theme;

    if (before === null || before === theme) {
      applyTheme(theme);

      return;
    }

    revealTheme(() => {
      applyTheme(theme);
    });
  }, [theme]);
};

export { useAppliedTheme };
