import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonSize = 'sm' | 'md' | 'lg'

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label'> & {
  /**
   * What the control does, in words.
   *
   * Required rather than optional: an icon on its own has no accessible name,
   * and a player made entirely of them would be unusable without sight.
   */
  label: string
  children: ReactNode
  size?: IconButtonSize
  isActive?: boolean
  /**
   * Whether resting a pointer on it shows the label.
   *
   * On by default. Off for a control whose name is already written beside it,
   * where a tooltip repeats a word the viewer is looking at.
   */
  hasTooltip?: boolean
  className?: string
}

export type { IconButtonProps, IconButtonSize }
