import type { ReactNode } from 'react'

type FilePickerProps = {
  label: string
  /**
   * What the browser should offer, as an `accept` list.
   */
  accept: string
  onPick: (file: File) => void
  children: ReactNode
  disabled?: boolean
  className?: string
}

export type { FilePickerProps }
