import cnModule from '@FluxUI/cn'
import SpinnerModule from '@FluxUI/Spinner'
import type { ButtonProps, ButtonSize, ButtonVariant } from './Button.types'

const { cn } = cnModule
const { Spinner } = SpinnerModule

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:opacity-90',
  glossy:
    'flux-gloss bg-white text-black hover:brightness-105 hover:shadow-[0_10px_30px_-6px_rgba(255,255,255,0.35)]',
  secondary: 'flux-glass text-text hover:brightness-125',
  ghost: 'bg-transparent text-text hover:bg-white/10',
  danger: 'flux-gloss bg-danger text-accent-contrast hover:brightness-110',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-6 text-lg gap-2.5',
  xl: 'h-14 px-8 text-lg gap-3 font-semibold',
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
  isPill = false,
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
        'inline-flex shrink-0 items-center justify-center font-medium',
        'transition-[filter,box-shadow,transform,translate,scale,opacity] duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100',
        'active:scale-[0.98]',
        isPill ? 'rounded-full' : 'rounded-lg',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} label="Loading" /> : null}
      {children}
    </button>
  )
}

Button.displayName = 'Button'

export default { Button }
