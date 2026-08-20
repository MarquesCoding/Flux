let covers = 0;

const listeners = new Set<() => void>();

const announce = (): void => {
  for (const tell of listeners) {
    tell();
  }
};

/**
 * Says that something is now standing over the page, and answers with how to stand down. Counted
 * rather than flagged, so two dialogs open at once do not have the first to close uncover a page
 * the second is still covering.
 *
 * @returns How to say it has gone.
 */
const coverPage = (): (() => void) => {
  covers += 1;
  announce();

  let hasGone = false;

  return () => {
    if (hasGone) {
      return;
    }

    hasGone = true;
    covers -= 1;
    announce();
  };
};

/**
 * Asks to be told whenever the page becomes covered or uncovered.
 *
 * @param tell - Told that it changed, without being told what to.
 * @returns How to stop being told.
 */
const watchPageCover = (tell: () => void): (() => void) => {
  listeners.add(tell);

  return () => {
    listeners.delete(tell);
  };
};

/**
 * Whether anything is standing over the page at this moment.
 */
const isPageCovered = (): boolean => covers > 0;

/**
 * Forgets everything standing over the page, for a test that would otherwise inherit the last one.
 */
const forgetPageCovers = (): void => {
  covers = 0;
  announce();
};

export { coverPage, watchPageCover, isPageCovered, forgetPageCovers };
