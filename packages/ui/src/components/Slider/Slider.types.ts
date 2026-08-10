import type { ReactNode } from 'react'

/**
 * Where the slider is drawn.
 *
 * `overlay` is for sliders sitting on top of video, where theme surface
 * colours are invisible against the picture and against each other.
 */
type SliderTone = 'default' | 'overlay'

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
  tone?: SliderTone
  className?: string
}

export type { SliderProps, SliderTone }
