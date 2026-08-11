import type { ReactNode } from 'react'

type TooltipProps = {
  /**
   * What the control does, in words.
   *
   * The same words as its accessible name. A tooltip that says something
   * different from the label is a second name for the same thing, and the two
   * drift.
   */
  label: string
  /**
   * The control itself.
   */
  children: ReactNode
  /**
   * Which way it hangs. Above by default, since most controls carrying one sit
   * in a bar along the bottom of something.
   */
  side?: 'top' | 'bottom' | 'left' | 'right'
  /**
   * Whether to say anything at all.
   *
   * For the caller that shows a name beside the icon already, where a tooltip
   * would repeat a word the viewer is looking at.
   */
  isDisabled?: boolean
}

export type { TooltipProps }
