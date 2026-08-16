import { cn } from '@FluxUI/cn';
import { Spinner } from '@FluxUI/Spinner';
import { Tooltip } from '@FluxUI/Tooltip';
import type { ButtonProps, ButtonSize, ButtonVariant } from './Button.types';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:opacity-90',
  glossy:
    'flux-gloss bg-white text-black hover:brightness-105 hover:shadow-[0_10px_30px_-6px_rgba(255,255,255,0.35)]',
  secondary:
    'border border-[var(--surface-line)] bg-surface-raised text-text hover:bg-[var(--surface-hover)]',
  ghost: 'bg-transparent text-text hover:bg-[var(--surface-hover)]',
  danger: 'bg-danger text-white hover:opacity-90',
  overlay: 'bg-scrim text-on-scrim backdrop-blur-md hover:brightness-125',
  link: 'bg-transparent text-text underline-offset-4 hover:underline',
  bare: '',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
  xl: 'h-12 px-6 text-base gap-2.5 font-semibold',
  none: '',
};

const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-10',
  xl: 'size-12',
  none: '',
};

/**
 * The one place a `<button>` is written. Everything pressable in Flux is this or composes it, which
 * is what keeps focus rings, disabled states, loading behaviour and tooltips the same everywhere
 * rather than reinvented per screen. A raw button elsewhere is lint-banned, and there is
 * deliberately no separate icon button — an icon button is this with an icon and a label.
 *
 * @param children - What the button shows; optional, since a control can be its own content.
 * @param variant - How it is painted, from the headline glossy down to bare, which paints nothing.
 * @param size - How large it is, or none to leave height and padding to the caller.
 * @param isLoading - Whether the thing it does is under way, which also stops it being pressed twice.
 * @param isPill - Whether to round it fully, which is how the platform's bars and docks are drawn.
 * @param label - What it does in words, required of anything wearing only an icon.
 * @param isIconOnly - Whether it is a glyph and nothing else, which makes it square and round.
 * @param isActive - Whether what it does is currently in force, said as well as shown.
 * @param hasTooltip - Whether resting a pointer on it shows the label.
 * @param tooltipDelayMilliseconds - How long a pointer rests before the label appears.
 * @param className - Extra classes for the caller's own layout.
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isPill = false,
  isIconOnly = false,
  isActive = false,
  hasTooltip = true,
  tooltipDelayMilliseconds,
  label,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const isDisabled = disabled === true || isLoading;
  const isBare = variant === 'bare';

  const control = (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      {...(label === undefined ? {} : { 'aria-label': label })}
      {...(isActive ? { 'aria-pressed': true } : {})}
      className={cn(
        'inline-flex font-medium',
        isBare ? '' : 'shrink-0 items-center justify-center',
        'transition-[filter,box-shadow,transform,translate,scale,opacity,background-color,color]',
        'duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100',
        isBare ? '' : 'active:scale-[0.98]',
        isBare && !isPill && !isIconOnly
          ? ''
          : isPill || isIconOnly
            ? 'rounded-full'
            : 'rounded-md',
        VARIANT_CLASSES[variant],
        isIconOnly ? ICON_SIZE_CLASSES[size] : SIZE_CLASSES[size],
        isActive && !isBare ? 'bg-white/20' : '',
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} label="Working" /> : null}
      {children}
    </button>
  );

  return label === undefined || !hasTooltip ? (
    control
  ) : (
    <Tooltip
      label={label}
      {...(tooltipDelayMilliseconds === undefined
        ? {}
        : { delayMilliseconds: tooltipDelayMilliseconds })}
    >
      {control}
    </Tooltip>
  );
};

Button.displayName = 'Button';

export { Button };
