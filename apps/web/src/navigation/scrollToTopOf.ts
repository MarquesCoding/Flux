/**
 * Scrolls whatever actually scrolls around an element back to its top, which is not always the
 * window — the pages are laid out in panes, and the one that scrolls is found by walking up from the
 * element rather than assumed.
 *
 * @param from - The element to start looking from.
 * @param isSmooth - Whether to animate, which a page arriving should not.
 */
const scrollToTopOf = (from: HTMLElement | null, isSmooth = true): void => {
  if (from === null) {
    return;
  }

  let holder = from.parentElement;

  while (holder !== null) {
    const style = window.getComputedStyle(holder);
    const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';

    if (scrolls && holder.scrollHeight > holder.clientHeight) {
      holder.scrollTo({ top: 0, behavior: isSmooth ? 'smooth' : 'auto' });

      return;
    }

    holder = holder.parentElement;
  }
};

export { scrollToTopOf };
