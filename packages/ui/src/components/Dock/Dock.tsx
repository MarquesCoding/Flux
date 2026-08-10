import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import cnModule from '@FluxUI/cn'
import revealModule from '@FluxUI/animations/reveal'
import type { DockProps } from './Dock.types'

const { cn } = cnModule
const { revealTransition, liquidSpring, settleTween, stillTransition } = revealModule

/**
 * The floating bar of places to go.
 *
 * Sits over the content rather than beside it, so the library keeps the full
 * width of a phone and the full height of a desktop. Fixed to the bottom
 * because that is where a thumb is, and centred because a bar pinned to one
 * edge of a wide screen is a long way from anything.
 *
 * Only the current place is named. An icon someone has already learned needs
 * no caption, and four captions across the bottom of every screen is a menu
 * pretending to be a dock — but the place you are standing is worth stating,
 * and the label sliding open as it becomes current is what makes the dock read
 * as one control rather than four.
 */
const Dock = ({ items, selectedId, onSelect, className }: DockProps) => {
  const prefersReducedMotion = useReducedMotion()
  // The highlight and the label want opposite things: the highlight should
  // overshoot and settle, and the label should not move a millimetre further
  // than it has to.
  const highlight = prefersReducedMotion === true ? stillTransition : liquidSpring
  const label = prefersReducedMotion === true ? stillTransition : settleTween

  return (
    <nav
      aria-label="Sections"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center',
        'px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {/* Arrives after the page rather than with it: the dock is an offer, and
          an offer that lands before the thing it is about competes with it. */}
      <motion.ul
        initial={
          prefersReducedMotion === true
            ? { opacity: 0 }
            : { opacity: 0, y: 28, scaleX: 0.7, filter: 'blur(6px)' }
        }
        animate={{ opacity: 1, y: 0, scaleX: 1, filter: 'blur(0px)' }}
        transition={{
          ...revealTransition(prefersReducedMotion, 'heavy'),
          delay: prefersReducedMotion === true ? 0 : 0.35,
        }}
        className="flux-glass pointer-events-auto flex items-center gap-1 rounded-full p-1.5"
      >
        {items.map((item) => {
          const isSelected = item.id === selectedId

          return (
            <li key={item.id} className="relative">
              {isSelected ? (
                <motion.span
                  layoutId="dock-selection"
                  transition={highlight}
                  className="absolute inset-0 rounded-full bg-white/15"
                />
              ) : null}

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
                  isSelected
                    ? 'px-4 text-text'
                    : 'w-12 justify-center text-text-muted hover:text-text sm:w-11',
                )}
              >
                <span className="flex shrink-0 items-center">{item.icon}</span>

                <AnimatePresence initial={false}>
                  {isSelected ? (
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
