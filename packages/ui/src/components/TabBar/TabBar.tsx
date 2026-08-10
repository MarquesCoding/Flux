import { motion, useReducedMotion } from 'motion/react'
import cnModule from '@FluxUI/cn'
import revealModule from '@FluxUI/animations/reveal'
import type { TabBarProps } from './TabBar.types'

const { cn } = cnModule
const { revealTransition } = revealModule

/**
 * Words across the top that filter what is beneath them.
 *
 * Text rather than boxes: a row of buttons competes with the artwork under it,
 * while a row of words reads as a heading that happens to be interactive. The
 * underline slides between them so the eye follows one moving thing.
 *
 * Scrolls horizontally rather than wrapping, because a phone will not fit them
 * and a second row of tabs is a menu nobody asked for.
 */
const TabBar = ({ tabs, selectedId, onSelect, label, className }: TabBarProps) => {
  const prefersReducedMotion = useReducedMotion()

  return (
    <nav aria-label={label} className={cn('flux-rail overflow-x-auto', className)}>
      <ul className="flex items-center gap-6 px-5 sm:px-10">
        {tabs.map((tab) => {
          const isSelected = tab.id === selectedId

          return (
            <li key={tab.id} className="relative shrink-0 py-3">
              <button
                type="button"
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => {
                  onSelect(tab.id)
                }}
                className={cn(
                  'text-xl font-semibold tracking-tight transition-colors sm:text-2xl',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0 focus-visible:rounded-md',
                  isSelected ? 'text-text' : 'text-text-muted/60 hover:text-text-muted',
                )}
              >
                {tab.label}
              </button>

              {isSelected ? (
                <motion.span
                  layoutId={`tabbar-${label}`}
                  transition={revealTransition(prefersReducedMotion)}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-text"
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

TabBar.displayName = 'TabBar'

export default { TabBar }
