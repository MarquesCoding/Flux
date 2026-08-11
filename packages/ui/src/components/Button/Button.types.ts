import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * `glossy` is the platform's headline control — lit from above, with a glow
 * that says "press me" from across a room. `primary` stays flat for forms and
 * settings, where a glowing button would be noise.
 */
type ButtonVariant = 'primary' | 'glossy' | 'secondary' | 'ghost' | 'danger'

type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  /**
   * Rounds the control fully, which is how a control reads as a pill rather
   * than a box. The platform's shell uses pills throughout.
   */
  isPill?: boolean
  className?: string
}

export type { ButtonProps, ButtonVariant, ButtonSize }
