const REVEAL_MILLISECONDS = 560;

const REVEAL_EASING = 'cubic-bezier(0.77, 0, 0.175, 1)';

const REVEAL_SOFTNESS = 80;

const REVEAL_LIFT = 10;

/**
 * Changes the theme with the new one opening out from where somebody pointed, rather than the whole
 * page swapping colour in a single frame.
 *
 * The browser photographs the page as it was, the theme is changed underneath, and the new page is
 * uncovered through a growing circle — so the change starts at the thing that was pressed and
 * spreads from it, which is what makes it read as caused rather than as a flicker. Where the
 * browser cannot photograph a page, or somebody has asked for less movement, the theme simply
 * changes.
 *
 * The edge is soft rather than cut. A clip is a hard boundary by definition and no amount of easing
 * softens it — what travelled across the page was a drawn line with one theme either side of it. A
 * mask can be soft, so the edge is a band a few centimetres wide that the new theme fades in
 * through, which reads as the colour arriving rather than as a shape being wiped over the page.
 *
 * The radius is a registered custom property because an unregistered one is a string as far as the
 * browser is concerned, and a string does not interpolate — the gradient would jump from its first
 * value to its last with nothing in between.
 *
 * The new page also lifts very slightly as it arrives, which is the difference between a colour
 * changing and a page being laid down.
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
  root.style.setProperty('--valence-reveal-x', `${x.toString()}px`);
  root.style.setProperty('--valence-reveal-y', `${y.toString()}px`);

  const shift = document.startViewTransition(apply);

  void shift.ready
    .then(() => {
      root.animate(
        {
          '--valence-reveal': ['0px', `${(reach + REVEAL_SOFTNESS).toString()}px`],
          transform: [`translateY(${REVEAL_LIFT.toString()}px)`, 'translateY(0px)'],
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
      root.style.removeProperty('--valence-reveal-x');
      root.style.removeProperty('--valence-reveal-y');
    });
};

export { revealTheme };
