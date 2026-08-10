import { motion, useReducedMotion } from 'motion/react'
import cnModule from '@FluxUI/cn'
import revealModule from '@FluxUI/animations/reveal'
import type { DockProps } from './Dock.types'

const { cn } = cnModule
const { revealTransition } = revealModule

/**
 * The floating bar of places to go.
 *
 * Sits over the content rather than beside it, so the library keeps the full
 * width of a phone and the full height of a desktop. Fixed to the bottom
 * because that is where a thumb is, and centred because a bar pinned to one
 * edge of a wide screen is a long way from anything.
 *
 * The selected item is marked by a pill that slides between them rather than
 * by each item colouring itself: one object moving reads as one control with a
 * position, where several fading reads as several controls agreeing.
 */
const Dock = ({ items, selectedId, onSelect, className }: DockProps) => {
  const prefersReducedMotion = useReducedMotion()

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
                  transition={revealTransition(prefersReducedMotion)}
                  className="absolute inset-0 rounded-full bg-white/15"
                />
              ) : null}

              <button
                type="button"
                aria-label={item.label}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => {
                  onSelect(item.id)
                }}
                className={cn(
                  'relative flex size-12 items-center justify-center rounded-full',
                  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                  'focus-visible:outline-accent sm:size-11',
                  isSelected ? 'text-text' : 'text-text-muted hover:text-text',
                )}
              >
                {item.icon}
              </button>
            </li>
          )
        })}
      </motion.ul>
    </nav>
  )
}

Dock.displayName = 'Dock'

export default { Dock }
