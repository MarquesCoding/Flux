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
