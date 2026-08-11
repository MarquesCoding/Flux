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
  isDisabled?: boolean
  className?: string
}

export type { PopoverPanelProps }
