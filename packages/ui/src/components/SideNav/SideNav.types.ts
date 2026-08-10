import type { ReactNode } from 'react'

type SideNavItem = {
  id: string
  label: string
  icon: ReactNode
}

type SideNavProps = {
  items: SideNavItem[]
  selectedId: string
  isExpanded: boolean
  onSelect: (id: string) => void
  onToggle: () => void
  /**
   * Drawn at the top, above the items. The mark the platform is known by.
   */
  brand?: ReactNode
  /**
   * Drawn at the bottom, below the items. Account and settings live here.
   */
  footer?: ReactNode
  className?: string
}

export type { SideNavItem, SideNavProps }
