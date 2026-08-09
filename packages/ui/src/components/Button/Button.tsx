import cnModule from '@FluxUI/cn'
import SpinnerModule from '@FluxUI/Spinner'
import type { ButtonProps, ButtonSize, ButtonVariant } from './Button.types'

const { cn } = cnModule
const { Spinner } = SpinnerModule

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:opacity-90',
  secondary: 'bg-surface-raised text-text border border-border hover:bg-surface',
  ghost: 'bg-transparent text-text hover:bg-surface-raised',
  danger: 'bg-danger text-accent-contrast hover:opacity-90',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
}

/**
 * The Flux button. Wraps the only `<button>` element permitted for this
 * purpose, so that application code never uses a raw control.
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const isDisabled = disabled === true || isLoading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} label="Loading" /> : null}
      {children}
    </button>
  )
}

Button.displayName = 'Button'

export default { Button }
