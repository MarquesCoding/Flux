import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import cnModule from '@FluxUI/cn'
import IconButtonModule from '@FluxUI/IconButton'
import type { SideNavProps } from './SideNav.types'

const { cn } = cnModule
const { IconButton } = IconButtonModule

/**
 * The rail down the side of the application.
 *
 * Collapses to icons rather than disappearing: a viewer who has collapsed it
 * still wants to know where they are, and an icon they have already learned is
 * enough to say so. The label stays in the accessible name either way, so
 * collapsing costs nothing to anyone using a screen reader.
 */
const SideNav = ({
  items,
  selectedId,
  isExpanded,
  onSelect,
  onToggle,
  brand,
  footer,
  className,
}: SideNavProps) => (
  <nav
    aria-label="Sections"
    data-expanded={isExpanded}
    className={cn(
      'flex h-full flex-col gap-6 border-r border-white/10 bg-black/30 backdrop-blur-2xl',
      'px-3 py-5 transition-[width] duration-300 ease-out',
      isExpanded ? 'w-60' : 'w-[4.5rem]',
      className,
    )}
  >
    <div
      className={cn('flex items-center gap-2', isExpanded ? 'justify-between' : 'justify-center')}
    >
      {isExpanded ? brand : null}

      <IconButton
        label={isExpanded ? 'Collapse the sidebar' : 'Expand the sidebar'}
        size="sm"
        onClick={onToggle}
      >
        {isExpanded ? (
          <IconLayoutSidebarLeftCollapse size={20} aria-hidden />
        ) : (
          <IconLayoutSidebarLeftExpand size={20} aria-hidden />
        )}
      </IconButton>
    </div>

    <ul className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const isSelected = item.id === selectedId

        return (
          <li key={item.id}>
            <button
              type="button"
              aria-label={item.label}
              aria-current={isSelected ? 'page' : undefined}
              onClick={() => {
                onSelect(item.id)
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                'focus-visible:outline-accent',
                isSelected
                  ? 'flux-glass text-text'
                  : 'text-text-muted hover:bg-white/10 hover:text-text',
                isExpanded ? '' : 'justify-center px-0',
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center">{item.icon}</span>
              {isExpanded ? <span className="truncate">{item.label}</span> : null}
            </button>
          </li>
        )
      })}
    </ul>

    {footer === undefined ? null : <div className="flex flex-col gap-2">{footer}</div>}
  </nav>
)

SideNav.displayName = 'SideNav'

export default { SideNav }
