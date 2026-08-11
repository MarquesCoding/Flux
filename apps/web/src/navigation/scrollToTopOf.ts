/**
 * Takes whatever is scrolling around an element back to its beginning.
 *
 * `scrollIntoView` asks the browser to bring a particular element into view,
 * which is a different question: it depends on where that element is at the
 * moment of asking, and an element that has just been mounted is somewhere
 * that has not been laid out yet. Asking the container to go to nought is the
 * same request with none of that doubt.
 *
 * The container is looked for rather than passed in, because the thing that
 * scrolls here is a dialog's own panel — owned by the component that draws the
 * dialog, not by the page inside it.
 */
const scrollToTopOf = (from: HTMLElement | null, isSmooth = true): void => {
  if (from === null) {
    return
  }

  let holder = from.parentElement

  while (holder !== null) {
    const style = window.getComputedStyle(holder)
    const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll'

    if (scrolls && holder.scrollHeight > holder.clientHeight) {
      holder.scrollTo({ top: 0, behavior: isSmooth ? 'smooth' : 'auto' })

      return
    }

    holder = holder.parentElement
  }

  // Nothing between here and the document scrolls, so the document does.
  window.scrollTo({ top: 0, behavior: isSmooth ? 'smooth' : 'auto' })
}

export default { scrollToTopOf }
