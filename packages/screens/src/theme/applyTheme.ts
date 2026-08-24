import type { Theme } from '@ValenceClient/shell/theme';

/**
 * Puts a chosen theme on the document, where the stylesheet can see it.
 *
 * An attribute rather than a swapped stylesheet, because every colour in Valence is a custom
 * property and the whole palette is redefined under one selector. Following the machine means
 * writing no attribute at all, which is what leaves `prefers-color-scheme` in charge — an absent
 * attribute is a real answer here rather than a missing one.
 *
 * Lives with the screens rather than beside the preference it reads, because touching the document
 * is drawing and the package that remembers the preference does not draw.
 *
 * @param theme - What was chosen.
 * @param root - The element to mark, which is the document's own in everything but a test.
 */
const applyTheme = (theme: Theme, root: HTMLElement = document.documentElement): void => {
  if (theme === 'system') {
    delete root.dataset['theme'];

    return;
  }

  root.dataset['theme'] = theme;
};

export { applyTheme };
