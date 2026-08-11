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
  className?: string
}

export type { DockItem, DockProps }
