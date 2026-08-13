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

/**
 * How big a button is allowed to be.
 *
 * Smaller than they were, and closer together: a page of controls at the old
 * sizes read as a page of buttons rather than a page with buttons on it. The
 * step between sizes is deliberately small, so that a row mixing two of them
 * still looks like one row.
 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
  xl: 'h-12 px-6 text-base gap-2.5 font-semibold',
  none: '',
};

/**
 * What an icon on its own is worth: a square, since there is no line of text to
 * set the width.
 */
const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-10',
  xl: 'size-12',
  none: '',
};

/**
 * The button.
 *
 * The only `<button>` element in Flux. Every other control that can be pressed
 * — a page marker, a place in the navigation, a row of a settings menu, an icon
 * in the player — is built out of this one, because a control that reimplements
 * a button reimplements its focus behaviour, its disabled behaviour and its
 * keyboard behaviour, and does so slightly wrong.
 *
 * Wearing only an icon is a shape of this button rather than a component of its
 * own: it insists on a label, becomes square, and shows that label to whoever
 * rests a pointer on it. Everything else about it — how it looks pressed, how
 * it behaves disabled — is unchanged, which is the point.
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
