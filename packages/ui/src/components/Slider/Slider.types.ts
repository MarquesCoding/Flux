import type { ReactNode } from 'react'

type SliderProps = {
  label: string
  value: number
  max: number
  /**
   * How far one arrow key moves the handle.
   */
  step?: number
  onValueChange: (value: number) => void
  /**
   * Drawn above the track at the point being hovered.
   *
   * Given the value under the pointer rather than a pixel offset, so a caller
   * can answer with a thumbnail, a chapter name, or nothing at all.
   */
  renderPreview?: (value: number) => ReactNode
  className?: string
}

export type { SliderProps }
