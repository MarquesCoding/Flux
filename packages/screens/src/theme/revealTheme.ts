const CROSSFADE_MILLISECONDS = 320;

/**
 * Whether movement has been turned down, by the machine or by somebody here.
 *
 * Asks the document rather than the preference itself, because the preference lives in the package
 * that does not draw and this is drawing. `applyMotion` has already written the answer there: an
 * explicit `full` overrules a machine asking for stillness, an explicit `reduced` asks for it
 * whatever the machine says, and nothing written at all leaves the machine in charge.
 *
 * @returns Whether to change the theme without animating it.
 */
const wantsStillness = (): boolean => {
  const asked = document.documentElement.dataset['motion'];

  if (asked === 'reduced') {
    return true;
  }

  if (asked === 'full') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Changes the theme by easing every colour from the old one to the new, rather than swapping the
 * page in a single frame.
 *
 * Deliberately not a view transition. That photographs the page and holds the photograph up while
 * the change runs, which stops anything playing inside it — the trailer behind the hero froze for
 * the whole of it and then skipped to catch up. A photograph also cannot be taken without hiding the
 * live page, so anything that went wrong with the snapshot read as a flicker. Easing the colours
 * needs no photograph: the page stays live, the video keeps playing, and what changes is only the
 * colour of things.
 *
 * The page is marked while it changes and the stylesheet does the rest, so the transition covers
 * everything drawn from a token — backgrounds, text, borders, icons — without anything having to opt
 * in. The mark is taken off afterwards, because a page permanently willing to ease its colours would
 * ease them on every hover as well.
 *
 * @param apply - What changes the theme.
 */
const revealTheme = (apply: () => void): void => {
  if (wantsStillness()) {
    apply();

    return;
  }

  const root = document.documentElement;

  root.dataset['themeShift'] = '';

  apply();

  window.setTimeout(() => {
    delete root.dataset['themeShift'];
  }, CROSSFADE_MILLISECONDS);
};

export { CROSSFADE_MILLISECONDS, revealTheme };
