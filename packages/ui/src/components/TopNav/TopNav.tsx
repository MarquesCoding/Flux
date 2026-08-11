import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import cnModule from '@FluxUI/cn'
import type { TopNavProps } from './TopNav.types'

const { cn } = cnModule

/**
 * The bar across the top, as two things rather than one.
 *
 * Places in one capsule and tools in another, floating over the page with a
 * gap between them. A single strip across the top makes every item look like
 * the same kind of item; two shapes say plainly that one group takes you
 * somewhere and the other does something where you are.
 *
 * Glass rather than a solid bar, so artwork carries on underneath: the page
 * belongs to what is being shown, and the navigation is something resting on
 * top of it.
 *
 * The places are named rather than drawn, and only the one being stood on
 * carries its icon — which arrives beside the word rather than replacing it,
 * so nothing shifts about except the badge itself.
 */
const TopNav = ({ brand, items, selectedId, onSelect, actions = [], className }: TopNavProps) => {
  const prefersReducedMotion = useReducedMotion()

  return (
    <header
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6', className)}
    >
      <nav
        aria-label="Sections"
        // Three columns rather than a row that spaces itself. The places
        // belong in the middle of the screen, not in the middle of whatever is
        // left over once the tools have taken their width.
        className="mx-auto grid max-w-[1800px] grid-cols-[1fr_auto_1fr] items-center gap-3"
      >
        <div className="pointer-events-auto flex min-w-0 items-center">{brand}</div>

        {/* The places. Scrollable at narrow widths rather than folded away
            behind a button: five words fit on a phone if they are allowed to
            run off the edge, and a menu that has to be opened to see where you
            can go is a menu nobody opens. */}
        <ul className="flux-glass pointer-events-auto flex min-w-0 items-center gap-0.5 justify-self-center overflow-x-auto rounded-full p-1 [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const isCurrent = item.id === selectedId

            return (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={isCurrent ? 'page' : undefined}
                  title={item.label}
                  onClick={() => {
                    onSelect(item.id)
                  }}
                  className={cn(
                    // The same height as a tool, so the two capsules are the
                    // same capsule at different lengths rather than two
                    // near-misses sitting beside each other.
                    'relative flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-200',
                    isCurrent
                      ? 'font-medium text-text'
                      : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {/* Under the word rather than around it, so the capsule
                      holds one moving highlight instead of five taking
                      turns. */}
                  {!isCurrent ? null : (
                    <motion.span
                      layoutId="top-nav-current"
                      transition={
                        prefersReducedMotion === true
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 420, damping: 34 }
                      }
                      className="absolute inset-0 -z-10 rounded-full bg-white/15"
                    />
                  )}

                  {item.icon === undefined ? null : (
                    <span className="flex shrink-0 items-center">{item.icon}</span>
                  )}

                  {/* The name only where it is being stood on. An icon is
                      enough to point at a place; a word is what tells you
                      where you are, and five words all the time is a strip of
                      words. */}
                  <AnimatePresence initial={false}>
                    {!isCurrent ? null : (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: prefersReducedMotion === true ? 0 : 0.24 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flux-glass pointer-events-auto flex shrink-0 items-center gap-0.5 justify-self-end rounded-full p-1">
          {actions.map((action) =>
            action.control === undefined ? (
              <button
                key={action.id}
                type="button"
                aria-label={action.label}
                aria-current={action.isCurrent === true ? 'page' : undefined}
                onClick={action.onSelect}
                className={cn(
                  'relative flex size-10 items-center justify-center rounded-full transition-colors duration-200',
                  action.isCurrent === true
                    ? 'bg-white/15 text-text'
                    : 'text-text-muted hover:bg-white/10 hover:text-text',
                )}
              >
                {action.icon}

                {action.badge === undefined ? null : (
                  <span className="absolute -right-0.5 -top-0.5">{action.badge}</span>
                )}
              </button>
            ) : (
              <div key={action.id} className="flex items-center">
                {action.control}
              </div>
            ),
          )}
        </div>
      </nav>
    </header>
  )
}

TopNav.displayName = 'TopNav'

export default { TopNav }
