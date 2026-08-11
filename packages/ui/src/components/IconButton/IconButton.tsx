import { cn } from '@FluxUI/cn'
import { Tooltip } from '@FluxUI/Tooltip'
import type { IconButtonProps, IconButtonSize } from './IconButton.types'

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
 *
 * That label is also shown to whoever rests a pointer on it. A row of glyphs
 * is learnable but not guessable, and the name is already written down — the
 * only question was whether anybody but a screen reader got to hear it. The
 * browser's own tooltip is not used: it takes about a second to appear, cannot
 * be styled to match anything, and sits wherever the pointer happens to be.
 */
const IconButton = ({
  label,
  children,
  size = 'md',
  isActive = false,
  className,
  type = 'button',
  hasTooltip = true,
  ...rest
}: IconButtonProps) => (
  <Tooltip label={label} isDisabled={!hasTooltip}>
    <button
      type={type}
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'text-current transition-colors hover:bg-white/15',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isActive ? 'bg-white/20' : '',
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  </Tooltip>
)

IconButton.displayName = 'IconButton'

export { IconButton }
