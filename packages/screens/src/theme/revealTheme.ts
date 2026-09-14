const REVEAL_MILLISECONDS = 560;

const REVEAL_EASING = 'cubic-bezier(0.77, 0, 0.175, 1)';

/**
 * Changes the theme with a circle of the new one opening out from where somebody pointed, rather
 * than the whole page swapping colour in a single frame.
 *
 * The browser photographs the page as it was, the theme is changed underneath, and the new page is
 * uncovered through a growing circle — so the change starts at the thing that was pressed and
 * spreads from it, which is what makes it read as caused rather than as a flicker. Where the
 * browser cannot photograph a page, or somebody has asked for less movement, the theme simply
 * changes.
 *
 * @param apply - What changes the theme, run once the page as it was has been captured.
 * @param from - Where the circle opens from, or nothing for the middle of the window.
 */
const revealTheme = (apply: () => void, from: { x: number; y: number } | null): void => {
  const isStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isStill || !('startViewTransition' in document)) {
    apply();

    return;
  }

  const root = document.documentElement;
  const x = from?.x ?? window.innerWidth / 2;
  const y = from?.y ?? window.innerHeight / 2;
  const reach = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  root.dataset['themeShift'] = '';

  const shift = document.startViewTransition(apply);

  void shift.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x.toString()}px ${y.toString()}px)`,
            `circle(${reach.toString()}px at ${x.toString()}px ${y.toString()}px)`,
          ],
        },
        {
          duration: REVEAL_MILLISECONDS,
          easing: REVEAL_EASING,
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => undefined);

  void shift.finished
    .catch(() => undefined)
    .finally(() => {
      delete root.dataset['themeShift'];
    });
};

export { revealTheme };
