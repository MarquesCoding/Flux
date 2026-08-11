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
  isDisabled?: boolean
  className?: string
}

export type { PopoverPanelProps }
