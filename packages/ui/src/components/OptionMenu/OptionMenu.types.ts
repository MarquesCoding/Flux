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
  /**
   * Which edge of the trigger the popup lines up with.
   *
   * `end` suits a small icon trigger at the corner of a bar — the player's
   * settings gear. `start` suits a full-width control such as a form field,
   * where the popup should hang directly under it rather than off to one
   * side.
   */
  align?: 'start' | 'center' | 'end'
  /**
   * Widens the popup to at least the trigger's own width.
   *
   * A form field expects the menu under it to answer for at least as much
   * space as the field claims; an icon trigger does not.
   */
  matchTriggerWidth?: boolean
}

export type { MenuGroup, MenuOption, OptionMenuProps }
