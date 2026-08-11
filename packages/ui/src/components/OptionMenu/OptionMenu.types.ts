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
  /**
   * A control that lives under the lists and does not close the menu.
   *
   * For the settings somebody adjusts by feel rather than picks once —
   * nudging subtitles into time means pressing a button, watching, and
   * pressing it again, which a menu that closes on every press makes
   * impossible.
   */
  footer?: ReactNode
  isDisabled?: boolean
  className?: string
}

export type { MenuGroup, MenuOption, OptionMenuProps }
