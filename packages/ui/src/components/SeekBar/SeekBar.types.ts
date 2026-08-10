import type { ReactNode } from 'react'

type SeekBarProps = {
  label: string
  position: number
  duration: number
  onSeek: (seconds: number) => void
  /**
   * Drawn above the bar at the point being hovered.
   *
   * Given the time under the pointer rather than a pixel offset, so the caller
   * can answer with a thumbnail, a chapter name, or nothing at all.
   */
  renderPreview?: (seconds: number) => ReactNode
  className?: string
}

export type { SeekBarProps }
