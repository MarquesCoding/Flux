import type { ReactNode } from 'react'

type PopoverPanelProps = {
  label: string
  trigger: ReactNode
  children: ReactNode
  /**
   * What the panel is about, drawn as its heading.
   *
   * Left out where the contents say it themselves.
   */
  heading?: string
  /**
   * Whether the panel is open, when the caller wants to say.
   *
   * Left out where nothing outside needs to close it. Passed where something
   * does — a list that navigates somewhere should not still be sitting there
   * over what it navigated to.
   */
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  /**
   * Which way the panel hangs.
   *
   * Above by default, because the first of these belonged to a bar along the
   * bottom of a player. A control in a bar along the top of a page needs the
   * other one.
   */
  side?: 'top' | 'bottom'
  isDisabled?: boolean
  className?: string
}

export type { PopoverPanelProps }
