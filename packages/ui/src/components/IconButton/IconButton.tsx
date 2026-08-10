import cnModule from '@FluxUI/cn'
import type { IconButtonProps, IconButtonSize } from './IconButton.types'

const { cn } = cnModule

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
}

/**
 * A control that is only an icon.
 *
 * Separate from `Button` because the two have different shapes and different
 * accessibility needs: this one is square, has no text to read, and therefore
 * insists on a label.
 */
const IconButton = ({
  label,
  children,
  size = 'md',
  isActive = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) => (
  <button
    type={type}
    aria-label={label}
    aria-pressed={isActive}
    title={label}
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-full',
      'text-current transition-colors hover:bg-white/15',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0',
      'disabled:cursor-not-allowed disabled:opacity-50',
      isActive ? 'bg-white/20' : '',
      SIZE_CLASSES[size],
      className,
    )}
    {...rest}
  >
    {children}
  </button>
)

IconButton.displayName = 'IconButton'

export default { IconButton }
