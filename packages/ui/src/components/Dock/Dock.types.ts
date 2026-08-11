import type { ReactNode } from 'react'

type DockItem = {
  id: string
  label: string
  icon: ReactNode
}

type DockProps = {
  items: DockItem[]
  selectedId: string
  onSelect: (id: string) => void
  /**
   * Whether the dock is showing only its icons.
   *
   * A page being read does not need the name of the place it is on written
   * across the top of it; a page being navigated does. Decided by whoever
   * knows what the page is doing rather than by the dock, which knows only
   * what is in it.
   */
  isCompact?: boolean
  className?: string
}

export type { DockItem, DockProps }
