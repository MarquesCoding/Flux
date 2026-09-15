import type { Motion } from '@ValenceClient/shell/motion';

/**
 * Puts a chosen amount of movement on the document, where the stylesheet can see it.
 *
 * An attribute rather than a class, for the same reason the theme uses one: the whole of the
 * stillness is written under a handful of selectors, and an attribute is what those selectors read.
 * Following the machine means writing no attribute at all, which leaves `prefers-reduced-motion` in
 * charge — an absent attribute is a real answer here rather than a missing one.
 *
 * `full` is written out as well as `reduced`, which is the part that is easy to miss. It exists to
 * say *not* still on a machine that asks for stillness everywhere, and the stylesheet needs
 * something to hang that exception on.
 *
 * Lives with the screens rather than beside the preference it reads, because touching the document
 * is drawing and the package that remembers the preference does not draw.
 *
 * @param motion - What was chosen.
 * @param root - The element to mark, which is the document's own in everything but a test.
 */
const applyMotion = (motion: Motion, root: HTMLElement = document.documentElement): void => {
  if (motion === 'system') {
    delete root.dataset['motion'];

    return;
  }

  root.dataset['motion'] = motion;
};

export { applyMotion };
