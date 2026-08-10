import type { ReactNode } from 'react'

type MenuOption = {
  id: string
  label: string
  detail?: string
}

/**
 * One column of choices.
 *
 * Grouped rather than flat so a menu can offer audio and subtitles side by
 * side, which is how a viewer thinks about them: one decision, two lists.
 */
type MenuGroup = {
  name: string
  options: MenuOption[]
  selectedId: string
  onSelect: (id: string) => void
}

type OptionMenuProps = {
  label: string
  trigger: ReactNode
  groups: MenuGroup[]
  isDisabled?: boolean
  className?: string
}

export type { MenuGroup, MenuOption, OptionMenuProps }
