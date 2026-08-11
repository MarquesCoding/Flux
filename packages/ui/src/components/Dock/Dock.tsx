import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import cnModule from '@FluxUI/cn'
import revealModule from '@FluxUI/animations/reveal'
import type { DockProps } from './Dock.types'

const { cn } = cnModule
const { revealTransition, liquidSpring, settleTween, stillTransition } = revealModule

/**
 * Where the highlight sits, in the dock's own terms.
 */
type Box = { left: number; top: number; width: number; height: number }

/**
 * The floating bar of places to go.
 *
 * Sits over the content rather than beside it, so the library keeps the full
 * width of a phone and the full height of a desktop. Centred, because a bar
 * pinned to one edge of a wide screen is a long way from anything.
 *
 * Only the current place is named. An icon someone has already learned needs
 * no caption, and four captions across the bottom of every screen is a menu
 * pretending to be a dock — but the place you are standing is worth stating,
 * and the label sliding open as it becomes current is what makes the dock read
 * as one control rather than four.
 */
const Dock = ({ items, selectedId, onSelect, isCompact = false, className }: DockProps) => {
  const prefersReducedMotion = useReducedMotion()
  const listRef = useRef<HTMLUListElement>(null)
  const itemsRef = useRef(new Map<string, HTMLLIElement>())
  // Where the highlight should be, measured from the dock rather than inferred
  // from the page. A shared layout animation would do this by itself, but it
  // measures in page coordinates, and the dock does not live in the page — it
  // is fixed over it, so scrolling and then changing section sent the
  // highlight travelling in from wherever the page had been.
  const [highlightBox, setHighlightBox] = useState<Box | null>(null)

  const measure = useCallback(() => {
    const item = itemsRef.current.get(selectedId)

    if (item === undefined) {
      return
    }

    // Offsets rather than a rectangle: an absolutely placed child starts from
    // its parent's padding box, and a rectangle is measured from the border
    // box — so the highlight sat the dock's own padding down and to the right
    // of the thing it was meant to be around.
    setHighlightBox({
      left: item.offsetLeft,
      top: item.offsetTop,
      width: item.offsetWidth,
      height: item.offsetHeight,
    })
  }, [selectedId])

  // Measured again as the dock changes shape, not only when the selection
  // does: the name of the place unrolls after it is chosen, and a highlight
  // that stopped at the old width would sit under half a word.
  useEffect(() => {
    measure()

    const list = listRef.current

    if (list === null || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(measure)

    observer.observe(list)

    for (const item of itemsRef.current.values()) {
      observer.observe(item)
    }

    return () => {
      observer.disconnect()
    }
  }, [measure, items.length, isCompact])
  // The highlight and the label want opposite things: the highlight should
  // overshoot and settle, and the label should not move a millimetre further
  // than it has to.
  const highlight = prefersReducedMotion === true ? stillTransition : liquidSpring
  const label = prefersReducedMotion === true ? stillTransition : settleTween

  return (
    <nav
      aria-label="Sections"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center',
        'px-4 pt-[max(0.75rem,env(safe-area-inset-top))]',
        className,
      )}
    >
      {/* Arrives after the page rather than with it: the dock is an offer, and
          an offer that lands before the thing it is about competes with it. */}
      <motion.ul
        initial={
          prefersReducedMotion === true
            ? { opacity: 0 }
            : { opacity: 0, y: -28, scaleX: 0.7, filter: 'blur(6px)' }
        }
        animate={{ opacity: 1, y: 0, scaleX: 1, filter: 'blur(0px)' }}
        transition={{
          ...revealTransition(prefersReducedMotion, 'heavy'),
          delay: prefersReducedMotion === true ? 0 : 0.35,
        }}
        ref={listRef}
        className="flux-glass pointer-events-auto relative flex items-center gap-1 rounded-full p-1.5"
      >
        {highlightBox === null ? null : (
          <motion.span
            aria-hidden
            // One highlight that moves, rather than one per item appearing
            // where the last disappeared. It is told where to go in numbers
            // taken from the dock, so nothing about the page can move it.
            initial={false}
            animate={{
              x: highlightBox.left,
              y: highlightBox.top,
              width: highlightBox.width,
              height: highlightBox.height,
            }}
            transition={highlight}
            className="pointer-events-none absolute left-0 top-0 rounded-full bg-white/15"
          />
        )}

        {items.map((item) => {
          const isSelected = item.id === selectedId

          return (
            <li
              key={item.id}
              ref={(element) => {
                if (element === null) {
                  itemsRef.current.delete(item.id)
                } else {
                  itemsRef.current.set(item.id, element)
                }
              }}
              className="relative"
            >
              <motion.button
                type="button"
                // Deliberately not a layout animation: that resizes by
                // scaling, which stretches the word inside it. Animating the
                // label's width instead resizes the button without touching
                // the text.
                aria-label={item.label}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => {
                  onSelect(item.id)
                }}
                className={cn(
                  'relative flex h-12 items-center rounded-full transition-colors sm:h-11',
                  isSelected && !isCompact
                    ? 'px-4 text-text'
                    : 'w-12 justify-center text-text-muted hover:text-text sm:w-11',
                )}
              >
                <span className="flex shrink-0 items-center">{item.icon}</span>

                <AnimatePresence initial={false}>
                  {isSelected && !isCompact ? (
                    <motion.span
                      // The label slides open rather than appearing: a word
                      // that pops into a bar makes the bar jump, where a word
                      // that unrolls makes the bar grow.
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{ opacity: 1, width: 'auto', marginLeft: 8 }}
                      exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                      transition={label}
                      className="overflow-hidden whitespace-nowrap text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </motion.button>
            </li>
          )
        })}
      </motion.ul>
    </nav>
  )
}

Dock.displayName = 'Dock'

export default { Dock }
