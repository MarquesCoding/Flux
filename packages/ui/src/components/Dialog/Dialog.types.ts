import type { ReactNode } from 'react'

type DialogProps = {
  /**
   * Named for anyone who cannot see it, and for anything looking for it.
   */
  label: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export type { DialogProps }
